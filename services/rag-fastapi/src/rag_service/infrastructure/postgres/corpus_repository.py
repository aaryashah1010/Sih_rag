import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from rag_service.ports.corpus_repository import ChunkRecord, DocumentVersionRecord, SourceRecord


class PostgresCorpusRepository:
    """SQLAlchemy Core implementation of CorpusRepository against the rag schema.

    Every multi-statement operation runs inside `engine.begin()` so a failure partway through
    (e.g. a bad chunk) never leaves a document version half-written.
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def upsert_source(self, source: SourceRecord) -> UUID:
        async with self._engine.begin() as conn:
            row = (await conn.execute(text("""
                INSERT INTO rag.sources (source_key, authority_name, canonical_url, jurisdiction_code, legal_domain_code, source_type)
                VALUES (:source_key, :authority_name, :canonical_url, :jurisdiction_code, :legal_domain_code, :source_type)
                ON CONFLICT (source_key) DO UPDATE SET
                    authority_name = EXCLUDED.authority_name,
                    canonical_url = EXCLUDED.canonical_url,
                    jurisdiction_code = EXCLUDED.jurisdiction_code,
                    legal_domain_code = EXCLUDED.legal_domain_code,
                    source_type = EXCLUDED.source_type
                RETURNING id
            """), source.__dict__)).one()
        return row.id

    async def upsert_document(self, source_id: UUID, title: str, external_identifier: str, canonical_url: str) -> UUID:
        async with self._engine.begin() as conn:
            row = (await conn.execute(text("""
                INSERT INTO rag.documents (source_id, title, external_identifier, canonical_url)
                VALUES (:source_id, :title, :external_identifier, :canonical_url)
                ON CONFLICT (source_id, external_identifier) DO UPDATE SET title = EXCLUDED.title
                RETURNING id
            """), {"source_id": source_id, "title": title, "external_identifier": external_identifier, "canonical_url": canonical_url})).one()
        return row.id

    async def get_or_create_document_version(self, document_id: UUID, version: DocumentVersionRecord) -> tuple[UUID, bool]:
        async with self._engine.begin() as conn:
            existing = (await conn.execute(text(
                "SELECT id FROM rag.document_versions WHERE document_id = :document_id AND sha256 = :sha256"
            ), {"document_id": document_id, "sha256": version.sha256})).first()
            if existing:
                return existing.id, False
            row = (await conn.execute(text("""
                INSERT INTO rag.document_versions
                    (document_id, sha256, retrieved_at, storage_uri, extraction_method, status)
                VALUES (:document_id, :sha256, :retrieved_at, :storage_uri, :extraction_method, 'STAGED')
                RETURNING id
            """), {"document_id": document_id, **version.__dict__})).one()
            return row.id, True

    async def replace_chunks(self, document_version_id: UUID, chunks: list[ChunkRecord], model_name: str, model_version: str) -> int:
        async with self._engine.begin() as conn:
            # STAGED/pre-activation document versions are re-ingested freely; this stays safe
            # because a version only reaches app.citations once its corpus is ACTIVE (docs 07 s.6.1),
            # long after this loader has finished.
            await conn.execute(text("DELETE FROM rag.chunks WHERE document_version_id = :id"), {"id": document_version_id})
            await conn.execute(text("DELETE FROM rag.sections WHERE document_version_id = :id"), {"id": document_version_id})

            section_id_by_label: dict[str, UUID] = {}
            section_index = 0
            for chunk in chunks:
                if chunk.section_label not in section_id_by_label:
                    row = (await conn.execute(text("""
                        INSERT INTO rag.sections (document_version_id, section_index, label, heading, level, page_start, page_end)
                        VALUES (:document_version_id, :section_index, :label, :label, 0, :page_start, :page_end)
                        RETURNING id
                    """), {
                        "document_version_id": document_version_id, "section_index": section_index,
                        "label": chunk.section_label, "page_start": chunk.page_start, "page_end": chunk.page_end,
                    })).one()
                    section_id_by_label[chunk.section_label] = row.id
                    section_index += 1

            for chunk_index, chunk in enumerate(chunks):
                chunk_row = (await conn.execute(text("""
                    INSERT INTO rag.chunks
                        (document_version_id, section_id, chunk_index, text, language, low_quality, page_start, page_end, metadata)
                    VALUES
                        (:document_version_id, :section_id, :chunk_index, :text, :language, :low_quality, :page_start, :page_end, :metadata)
                    RETURNING id
                """), {
                    "document_version_id": document_version_id,
                    "section_id": section_id_by_label[chunk.section_label],
                    "chunk_index": chunk_index,
                    "text": chunk.text,
                    "language": chunk.language,
                    "low_quality": chunk.low_quality,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                    "metadata": json.dumps(chunk.metadata),
                })).one()
                await conn.execute(text("""
                    INSERT INTO rag.chunk_embeddings (chunk_id, model_name, model_version, embedding)
                    VALUES (:chunk_id, :model_name, :model_version, :embedding::vector)
                """), {
                    "chunk_id": chunk_row.id, "model_name": model_name, "model_version": model_version,
                    "embedding": _vector_literal(chunk.embedding),
                })
        return len(chunks)

    async def mark_document_version_validated(self, document_version_id: UUID, extraction_quality: float) -> None:
        async with self._engine.begin() as conn:
            await conn.execute(text(
                "UPDATE rag.document_versions SET status = 'VALIDATED', extraction_quality = :quality WHERE id = :id"
            ), {"id": document_version_id, "quality": extraction_quality})

    async def begin_corpus(self, name: str, manifest_uri: str, manifest_sha256: str, embedding_model: str, embedding_dimension: int) -> UUID:
        async with self._engine.begin() as conn:
            row = (await conn.execute(text("""
                INSERT INTO rag.corpus_versions (name, manifest_uri, manifest_sha256, embedding_model, embedding_dimension, status)
                VALUES (:name, :manifest_uri, :manifest_sha256, :embedding_model, :embedding_dimension, 'BUILDING')
                RETURNING id
            """), {
                "name": name, "manifest_uri": manifest_uri, "manifest_sha256": manifest_sha256,
                "embedding_model": embedding_model, "embedding_dimension": embedding_dimension,
            })).one()
        return row.id

    async def add_corpus_member(self, corpus_version_id: UUID, document_version_id: UUID) -> None:
        async with self._engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO rag.corpus_members (corpus_version_id, document_version_id)
                VALUES (:corpus_version_id, :document_version_id)
                ON CONFLICT DO NOTHING
            """), {"corpus_version_id": corpus_version_id, "document_version_id": document_version_id})

    async def mark_corpus_ready(self, corpus_version_id: UUID) -> None:
        async with self._engine.begin() as conn:
            await conn.execute(text(
                "UPDATE rag.corpus_versions SET status = 'READY' WHERE id = :id AND status = 'BUILDING'"
            ), {"id": corpus_version_id})

    async def mark_corpus_failed(self, corpus_version_id: UUID, reason: str) -> None:
        async with self._engine.begin() as conn:
            await conn.execute(text(
                "UPDATE rag.corpus_versions SET status = 'FAILED' WHERE id = :id"
            ), {"id": corpus_version_id})
        # `reason` is surfaced to the operator via the CLI/log, not stored: corpus_versions has no
        # free-text error column (unlike rag.ingestion_runs.error_summary).
        _ = reason

    async def activate_corpus(self, corpus_version_id: UUID) -> None:
        async with self._engine.begin() as conn:
            # Locks corpus_versions for the duration of the transaction so a concurrent activation
            # cannot interleave and leave two rows ACTIVE.
            await conn.execute(text("LOCK TABLE rag.corpus_versions IN SHARE ROW EXCLUSIVE MODE"))
            ready = (await conn.execute(text(
                "SELECT status FROM rag.corpus_versions WHERE id = :id"
            ), {"id": corpus_version_id})).first()
            if not ready or ready.status != "READY":
                raise ValueError("Only a READY corpus version can be activated")
            await conn.execute(text(
                "UPDATE rag.corpus_versions SET status = 'RETIRED', retired_at = now() WHERE status = 'ACTIVE'"
            ))
            await conn.execute(text(
                "UPDATE rag.corpus_versions SET status = 'ACTIVE', activated_at = now() WHERE id = :id"
            ), {"id": corpus_version_id})


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(repr(float(value)) for value in values) + "]"
