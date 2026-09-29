from dataclasses import dataclass
from typing import Protocol

from rag_service.ports.embeddings import EmbeddingProvider
from rag_service.ports.retrieval import ChunkRepository, EvidenceChunk, SearchQuery


class NoActiveCorpusError(Exception):
    pass


@dataclass(frozen=True)
class ActiveCorpusInfo:
    id: str
    embedding_model: str


class ActiveCorpusLookup(Protocol):
    async def current(self) -> ActiveCorpusInfo | None: ...


@dataclass(frozen=True)
class EvidenceSearchRequest:
    query_text: str
    jurisdiction: str
    legal_domains: tuple[str, ...] = ()
    context_top_k: int = 10


@dataclass(frozen=True)
class EvidenceSearchResult:
    corpus_version_id: str
    results: list[EvidenceChunk]


class EvidenceSearchService:
    """P1.6 hybrid search (docs/08-RAG-AND-RETRIEVAL.md). Reranking (P1.7) and grounded
    generation (P1.8) are not implemented yet; this returns ranked evidence only.
    """

    def __init__(self, corpus: ActiveCorpusLookup, chunks: ChunkRepository, embeddings: EmbeddingProvider) -> None:
        self._corpus = corpus
        self._chunks = chunks
        self._embeddings = embeddings

    async def search(self, request: EvidenceSearchRequest) -> EvidenceSearchResult:
        active = await self._corpus.current()
        if active is None:
            raise NoActiveCorpusError("No validated legal corpus is active.")
        if active.embedding_model != self._embeddings.model_name:
            # The active corpus was embedded with a different model than this process is
            # configured for; a query vector from this model would be meaningless against it.
            raise NoActiveCorpusError(
                f"Active corpus embedding model ({active.embedding_model!r}) does not match "
                f"this service's configured model ({self._embeddings.model_name!r})."
            )

        [query_vector] = self._embeddings.embed([request.query_text])
        results = await self._chunks.hybrid_search(SearchQuery(
            query_text=request.query_text,
            query_embedding=query_vector,
            jurisdiction=request.jurisdiction,
            legal_domains=request.legal_domains,
            context_top_k=request.context_top_k,
        ))
        return EvidenceSearchResult(corpus_version_id=active.id, results=results)
