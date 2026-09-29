import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path

from rag_service.ports.corpus_repository import ChunkRecord, CorpusRepository, DocumentVersionRecord, SourceRecord
from rag_service.ports.embeddings import EmbeddingProvider

EXTRACTION_METHOD_BY_CONTENT_TYPE = {"application/pdf": "PDF_TEXT", "text/html": "HTML"}
# Below this length a chunk is likely a caption/table fragment rather than usable evidence text;
# it is still indexed (never silently dropped) but flagged so a high-risk answer cannot rest on it
# alone (docs/07-DATABASE-SCHEMA.md rag.chunks.low_quality; docs/06 s.10 OCR quality gate applies
# the same principle to weak extractions in general).
LOW_QUALITY_TEXT_LENGTH = 80


class CorpusLoadError(Exception):
    pass


@dataclass(frozen=True)
class LoadResult:
    corpus_version_id: str
    corpus_name: str
    document_versions_loaded: int
    document_versions_unchanged: int
    chunks_embedded: int
    activated: bool


class CorpusLoadingService:
    """Reads a completed ingestion run (chunks.jsonl + corpus-manifest.json) and publishes it as a
    queryable corpus version: rag.documents/document_versions/sections/chunks/chunk_embeddings,
    then rag.corpus_versions, following the BUILDING -> READY -> ACTIVE lifecycle in
    docs/26-DESIGN-PATTERNS.md and docs/23-OPERATIONS-RUNBOOK.md.
    """

    def __init__(self, repository: CorpusRepository, embeddings: EmbeddingProvider) -> None:
        self._repository = repository
        self._embeddings = embeddings

    async def load(self, processed_dir: Path, *, activate: bool) -> LoadResult:
        manifest_path = processed_dir / "corpus-manifest.json"
        chunks_path = processed_dir / "chunks.jsonl"
        if not manifest_path.exists() or not chunks_path.exists():
            raise CorpusLoadError(f"{processed_dir} does not contain corpus-manifest.json and chunks.jsonl")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest["status"] != "NEEDS_REVIEW":
            # Ingestion marks the corpus FAILED when any source failed; never load a run that
            # is missing sources it was supposed to have (docs/06 s.13: re-ingestion safety).
            raise CorpusLoadError(f"Refusing to load a corpus with status={manifest['status']!r}: fix and re-run ingestion first")

        chunks_by_source: dict[str, list[dict]] = defaultdict(list)
        for line in chunks_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                chunk = json.loads(line)
                chunks_by_source[chunk["source_key"]].append(chunk)

        corpus_version_id = await self._repository.begin_corpus(
            name=manifest["corpus_version"],
            manifest_uri=str(manifest_path),
            manifest_sha256=sha256(manifest_path.read_bytes()).hexdigest(),
            embedding_model=self._embeddings.model_name,
            embedding_dimension=self._embeddings.dimension,
        )

        loaded = unchanged = total_chunks = 0
        try:
            for source_record in manifest["sources"]:
                source_key = source_record["source_key"]
                document_version_id, was_created, embedded = await self._load_source(source_record, chunks_by_source.get(source_key, []))
                await self._repository.add_corpus_member(corpus_version_id, document_version_id)
                loaded += 1 if was_created else 0
                unchanged += 0 if was_created else 1
                total_chunks += embedded
        except Exception as error:
            await self._repository.mark_corpus_failed(corpus_version_id, str(error))
            raise CorpusLoadError(f"Loading corpus {manifest['corpus_version']} failed: {error}") from error

        await self._repository.mark_corpus_ready(corpus_version_id)
        if activate:
            await self._repository.activate_corpus(corpus_version_id)

        return LoadResult(
            corpus_version_id=str(corpus_version_id),
            corpus_name=manifest["corpus_version"],
            document_versions_loaded=loaded,
            document_versions_unchanged=unchanged,
            chunks_embedded=total_chunks,
            activated=activate,
        )

    async def _load_source(self, source_record: dict, chunks: list[dict]) -> tuple[str, bool, int]:
        if not chunks:
            raise CorpusLoadError(f"No chunks found for source {source_record['source_key']!r} in chunks.jsonl")

        source_id = await self._repository.upsert_source(SourceRecord(
            source_key=source_record["source_key"],
            authority_name=source_record["authority"],
            canonical_url=source_record["source_url"],
            jurisdiction_code=source_record["jurisdiction"],
            legal_domain_code=source_record["legal_domain"],
            source_type=source_record["source_type"],
        ))
        document_id = await self._repository.upsert_document(
            source_id, title=chunks[0]["document_title"], external_identifier=source_record["source_key"],
            canonical_url=source_record["source_url"],
        )
        document_version_id, created = await self._repository.get_or_create_document_version(document_id, DocumentVersionRecord(
            sha256=source_record["sha256"],
            retrieved_at=datetime.fromisoformat(source_record["retrieved_at"]),
            storage_uri=source_record["raw_artifact"],
            extraction_method=EXTRACTION_METHOD_BY_CONTENT_TYPE.get(source_record["content_type"], "MANUAL"),
        ))

        if not created:
            # Same content already loaded under this document; do not re-embed or re-write chunks.
            return document_version_id, False, len(chunks)

        embeddings = self._embeddings.embed([chunk["text"] for chunk in chunks])
        records = [
            ChunkRecord(
                section_label=chunk["section_label"],
                page_start=chunk["page_start"],
                page_end=chunk["page_end"],
                text=chunk["text"],
                language=chunk["language"],
                low_quality=len(chunk["text"]) < LOW_QUALITY_TEXT_LENGTH,
                metadata={
                    "jurisdiction": chunk["jurisdiction"],
                    "legal_domain": chunk["legal_domain"],
                    "authority": chunk["authority"],
                    "source_url": chunk["source_url"],
                    "instrument_name": chunk["document_title"],
                    "source_type": chunk["source_type"],
                    "review_status": chunk["review_status"],
                },
                embedding=vector,
            )
            for chunk, vector in zip(chunks, embeddings, strict=True)
        ]
        embedded = await self._repository.replace_chunks(
            document_version_id, records, self._embeddings.model_name, self._embeddings.model_version
        )
        # extraction_quality reflects text-extraction confidence, not legal-currency review;
        # PDF_TEXT extraction (no OCR) is treated as fully confident regardless of review_status.
        await self._repository.mark_document_version_validated(document_version_id, extraction_quality=1.0)
        return document_version_id, True, embedded
