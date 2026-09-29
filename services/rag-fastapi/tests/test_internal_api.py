import os
import time
import uuid

os.environ.setdefault("RAG_SERVICE_TOKEN_SECRET", "test-service-secret-that-is-long-enough")

import jwt
import pytest
from fastapi.testclient import TestClient

from rag_service.api.rag import get_rag_query_service
from rag_service.application.rag_query import ActiveCorpus, RagQueryService
from rag_service.main import app

SECRET = os.environ["RAG_SERVICE_TOKEN_SECRET"]


def token(**overrides) -> str:
    now = int(time.time())
    claims = {"sub": "api-node", "iss": "ipsakti-api-node", "aud": "ipsakti-rag-internal", "iat": now, "exp": now + 60}
    claims.update(overrides)
    secret = claims.pop("_secret", SECRET)
    return jwt.encode(claims, secret, algorithm="HS256")


def body(**overrides) -> dict:
    value = {
        "request_id": str(uuid.uuid4()),
        "trace_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "message_id": str(uuid.uuid4()),
        "query": "Can I patent a neem formulation?",
        "jurisdiction": "INDIA",
        "language": "en",
        "product_context": {},
    }
    value.update(overrides)
    return value


class FakeCorpus:
    def __init__(self, corpus: ActiveCorpus | None) -> None:
        self.corpus = corpus

    async def active_corpus(self) -> ActiveCorpus | None:
        return self.corpus


@pytest.fixture
def client():
    def use(corpus: ActiveCorpus | None) -> TestClient:
        app.dependency_overrides[get_rag_query_service] = lambda: RagQueryService(FakeCorpus(corpus))
        return TestClient(app)

    yield use
    app.dependency_overrides.clear()


def test_health_needs_no_token(client):
    assert client(None).get("/internal/v1/health").json() == {"status": "ok"}


@pytest.mark.parametrize("bad", [
    None,
    token(_secret="a-browser-access-token-secret-of-enough-length"),
    token(aud="ipsakti-web"),
    token(iss="someone-else"),
    token(exp=int(time.time()) - 60),
    token(iat=int(time.time()), exp=int(time.time()) + 3600),
])
def test_rejects_missing_or_invalid_service_tokens(client, bad):
    headers = {"Authorization": f"Bearer {bad}"} if bad else {}
    response = client(None).post("/internal/v1/rag/query", json=body(), headers=headers)
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "SERVICE_TOKEN_INVALID"


def test_rejects_unknown_fields_and_bad_jurisdiction(client):
    headers = {"Authorization": f"Bearer {token()}"}
    unknown = client(None).post("/internal/v1/rag/query", json=body(extra="x"), headers=headers)
    assert unknown.status_code == 422
    wrong = client(None).post("/internal/v1/rag/query", json=body(jurisdiction="USA"), headers=headers)
    assert wrong.status_code == 422


def test_fails_closed_without_active_corpus(client):
    response = client(None).post(
        "/internal/v1/rag/query", json=body(), headers={"Authorization": f"Bearer {token()}", "X-Request-Id": "req-1"}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "RAG_CORPUS_UNAVAILABLE"
    assert response.json()["request_id"] == "req-1"


def test_fails_closed_until_retrieval_exists(client):
    corpus = ActiveCorpus(id=uuid.uuid4(), name="india-patent-mvp", embedding_model="test")
    response = client(corpus).post("/internal/v1/rag/query", json=body(), headers={"Authorization": f"Bearer {token()}"})
    assert response.status_code == 503
    assert response.json()["code"] == "RAG_RETRIEVAL_UNAVAILABLE"
