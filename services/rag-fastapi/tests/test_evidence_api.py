import os
import time

os.environ.setdefault("RAG_SERVICE_TOKEN_SECRET", "test-service-secret-that-is-long-enough")

import jwt
import pytest
from fastapi.testclient import TestClient

from rag_service.api.evidence import get_evidence_search_service
from rag_service.application.evidence_search import EvidenceSearchRequest, EvidenceSearchService
from rag_service.main import app
from rag_service.ports.retrieval import EvidenceChunk

SECRET = os.environ["RAG_SERVICE_TOKEN_SECRET"]


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": "api-node", "iss": "ipsakti-api-node", "aud": "ipsakti-rag-internal", "iat": now, "exp": now + 60},
        SECRET, algorithm="HS256",
    )


class FixedResultService:
    """A minimal EvidenceSearchService stand-in that returns a canned result or raises."""

    def __init__(self, result=None, error: Exception | None = None) -> None:
        self._result, self._error = result, error

    async def search(self, request: EvidenceSearchRequest):
        if self._error:
            raise self._error
        return self._result


def make_chunk(chunk_id: str) -> EvidenceChunk:
    return EvidenceChunk(
        chunk_id=chunk_id, document_version_id="dv-1", text="Section 3 text",
        section_label="3. What are not inventions", authority="IP India",
        document_title="Patents Act, 1970", source_url="https://ipindia.gov.in/x.pdf",
        jurisdiction="INDIA", legal_domain="PATENT", language="en",
        page_start=9, page_end=10, low_quality=False,
        lexical_score=0.8, vector_score=0.9, fused_score=0.85, rank=1,
    )


@pytest.fixture
def client():
    def use(service) -> TestClient:
        app.dependency_overrides[get_evidence_search_service] = lambda: service
        return TestClient(app)

    yield use
    app.dependency_overrides.clear()


def test_requires_a_service_token(client):
    from rag_service.application.evidence_search import EvidenceSearchResult
    service = FixedResultService(EvidenceSearchResult(corpus_version_id="c1", results=[]))
    response = client(service).post("/internal/v1/evidence/search", json={"query": "q", "jurisdiction": "INDIA"})
    assert response.status_code == 401


def test_returns_ranked_evidence(client):
    from rag_service.application.evidence_search import EvidenceSearchResult
    service = FixedResultService(EvidenceSearchResult(corpus_version_id="corpus-1", results=[make_chunk("c1")]))
    response = client(service).post(
        "/internal/v1/evidence/search",
        json={"query": "Can I patent a neem formulation?", "jurisdiction": "INDIA"},
        headers={"Authorization": f"Bearer {token()}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["corpus_version_id"] == "corpus-1"
    assert body["results"][0]["chunk_id"] == "c1"
    assert body["results"][0]["section_label"] == "3. What are not inventions"


def test_rejects_unknown_fields_and_bad_jurisdiction(client):
    from rag_service.application.evidence_search import EvidenceSearchResult
    service = FixedResultService(EvidenceSearchResult(corpus_version_id="c1", results=[]))
    headers = {"Authorization": f"Bearer {token()}"}
    unknown = client(service).post("/internal/v1/evidence/search", json={"query": "q", "jurisdiction": "INDIA", "extra": 1}, headers=headers)
    assert unknown.status_code == 422
    bad = client(service).post("/internal/v1/evidence/search", json={"query": "q", "jurisdiction": "MARS"}, headers=headers)
    assert bad.status_code == 422


def test_no_active_corpus_returns_503_problem(client):
    from rag_service.application.evidence_search import NoActiveCorpusError
    service = FixedResultService(error=NoActiveCorpusError("No validated legal corpus is active."))
    response = client(service).post(
        "/internal/v1/evidence/search", json={"query": "q", "jurisdiction": "INDIA"},
        headers={"Authorization": f"Bearer {token()}"},
    )
    assert response.status_code == 503
    assert response.json()["code"] == "RAG_CORPUS_UNAVAILABLE"
