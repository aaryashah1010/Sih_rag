from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SearchQuery:
    query_text: str
    query_embedding: list[float]
    jurisdiction: str
    legal_domains: tuple[str, ...] = ()
    lexical_top_k: int = 50
    vector_top_k: int = 50
    context_top_k: int = 10


@dataclass(frozen=True)
class EvidenceChunk:
    chunk_id: str
    document_version_id: str
    text: str
    section_label: str | None
    authority: str
    document_title: str
    source_url: str | None
    jurisdiction: str
    legal_domain: str
    language: str
    page_start: int | None
    page_end: int | None
    low_quality: bool
    lexical_score: float | None
    vector_score: float | None
    fused_score: float
    rank: int


class ChunkRepository(Protocol):
    """Hybrid lexical + vector search against the ACTIVE corpus only (docs/08-RAG-AND-RETRIEVAL.md)."""

    async def hybrid_search(self, query: SearchQuery) -> list[EvidenceChunk]: ...
