import pytest

from rag_service.application.evidence_search import (
    ActiveCorpusInfo,
    EvidenceSearchRequest,
    EvidenceSearchService,
    NoActiveCorpusError,
)
from rag_service.ports.retrieval import EvidenceChunk, SearchQuery


class FakeCorpusLookup:
    def __init__(self, active: ActiveCorpusInfo | None) -> None:
        self.active = active

    async def current(self):
        return self.active


class FakeEmbeddings:
    model_name = "fake-embedder"
    model_version = "1"
    dimension = 4

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, 0.0, 0.0, 0.0] for _ in texts]


class FakeChunkRepository:
    def __init__(self, results: list[EvidenceChunk]) -> None:
        self.results = results
        self.received: SearchQuery | None = None

    async def hybrid_search(self, query: SearchQuery) -> list[EvidenceChunk]:
        self.received = query
        return self.results


def make_chunk(chunk_id: str, rank: int) -> EvidenceChunk:
    return EvidenceChunk(
        chunk_id=chunk_id, document_version_id="dv-1", text="Section text",
        section_label="3. What are not inventions", authority="IP India",
        document_title="Patents Act, 1970", source_url="https://ipindia.gov.in/x.pdf",
        jurisdiction="INDIA", legal_domain="PATENT", language="en",
        page_start=9, page_end=10, low_quality=False,
        lexical_score=0.8, vector_score=0.9, fused_score=0.85, rank=rank,
    )


@pytest.mark.asyncio
async def test_raises_when_no_active_corpus():
    service = EvidenceSearchService(FakeCorpusLookup(None), FakeChunkRepository([]), FakeEmbeddings())
    with pytest.raises(NoActiveCorpusError):
        await service.search(EvidenceSearchRequest(query_text="neem patent", jurisdiction="INDIA"))


@pytest.mark.asyncio
async def test_raises_when_embedding_model_does_not_match_active_corpus():
    corpus = ActiveCorpusInfo(id="corpus-1", embedding_model="a-different-model")
    service = EvidenceSearchService(FakeCorpusLookup(corpus), FakeChunkRepository([]), FakeEmbeddings())
    with pytest.raises(NoActiveCorpusError, match="does not match"):
        await service.search(EvidenceSearchRequest(query_text="neem patent", jurisdiction="INDIA"))


@pytest.mark.asyncio
async def test_returns_ranked_evidence_and_passes_jurisdiction_through():
    corpus = ActiveCorpusInfo(id="corpus-1", embedding_model="fake-embedder")
    chunks = FakeChunkRepository([make_chunk("c1", 1), make_chunk("c2", 2)])
    service = EvidenceSearchService(FakeCorpusLookup(corpus), chunks, FakeEmbeddings())

    result = await service.search(EvidenceSearchRequest(
        query_text="Can I patent a neem formulation?", jurisdiction="INDIA",
        legal_domains=("PATENT", "TRADITIONAL_KNOWLEDGE"), context_top_k=5,
    ))

    assert result.corpus_version_id == "corpus-1"
    assert [chunk.chunk_id for chunk in result.results] == ["c1", "c2"]
    assert chunks.received.jurisdiction == "INDIA"
    assert chunks.received.legal_domains == ("PATENT", "TRADITIONAL_KNOWLEDGE")
    assert chunks.received.context_top_k == 5
    assert chunks.received.query_embedding == [1.0, 0.0, 0.0, 0.0]


@pytest.mark.asyncio
async def test_empty_results_are_not_an_error():
    corpus = ActiveCorpusInfo(id="corpus-1", embedding_model="fake-embedder")
    service = EvidenceSearchService(FakeCorpusLookup(corpus), FakeChunkRepository([]), FakeEmbeddings())
    result = await service.search(EvidenceSearchRequest(query_text="unrelated question", jurisdiction="INDIA"))
    assert result.results == []
