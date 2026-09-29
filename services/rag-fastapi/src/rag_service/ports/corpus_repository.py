from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class SourceRecord:
    source_key: str
    authority_name: str
    canonical_url: str
    jurisdiction_code: str
    legal_domain_code: str
    source_type: str


@dataclass(frozen=True)
class DocumentVersionRecord:
    sha256: str
    retrieved_at: datetime
    storage_uri: str
    extraction_method: str


@dataclass(frozen=True)
class ChunkRecord:
    section_label: str
    page_start: int | None
    page_end: int | None
    text: str
    language: str
    low_quality: bool
    metadata: dict[str, object]
    embedding: list[float]


class CorpusRepository(Protocol):
    """Persistence boundary for the ingestion loader. Implemented against PostgreSQL/rag schema."""

    async def upsert_source(self, source: SourceRecord) -> UUID: ...

    async def upsert_document(self, source_id: UUID, title: str, external_identifier: str, canonical_url: str) -> UUID: ...

    async def get_or_create_document_version(self, document_id: UUID, version: DocumentVersionRecord) -> tuple[UUID, bool]:
        """Returns (document_version_id, created). `created=False` means this exact sha256 was
        already loaded, so the caller should skip re-chunking/re-embedding it."""
        ...

    async def replace_chunks(self, document_version_id: UUID, chunks: list[ChunkRecord], model_name: str, model_version: str) -> int:
        """Replaces this document version's sections/chunks/embeddings and returns the chunk count."""
        ...

    async def mark_document_version_validated(self, document_version_id: UUID, extraction_quality: float) -> None: ...

    async def begin_corpus(self, name: str, manifest_uri: str, manifest_sha256: str, embedding_model: str, embedding_dimension: int) -> UUID: ...

    async def add_corpus_member(self, corpus_version_id: UUID, document_version_id: UUID) -> None: ...

    async def mark_corpus_ready(self, corpus_version_id: UUID) -> None: ...

    async def mark_corpus_failed(self, corpus_version_id: UUID, reason: str) -> None: ...

    async def activate_corpus(self, corpus_version_id: UUID) -> None:
        """Atomically retires the current ACTIVE corpus (if any) and activates this READY one."""
        ...
