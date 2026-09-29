from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from rag_service.api.problems import ProblemError
from rag_service.api.security import ServiceCaller, require_service_token
from rag_service.application.rag_query import (
    CorpusUnavailableError,
    RagQueryService,
    RetrievalUnavailableError,
)
from rag_service.db import get_engine
from rag_service.infrastructure.postgres import PostgresCorpusRepository

router = APIRouter(prefix="/internal/v1", tags=["rag"])

Decision = Literal["PASS", "PASS_WITH_CAUTION", "ABSTAIN", "ESCALATE"]


class RagQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: UUID
    trace_id: UUID
    session_id: UUID
    message_id: UUID
    query: Annotated[str, Field(min_length=1, max_length=4000)]
    jurisdiction: Literal["INDIA", "INTERNATIONAL"]
    language: Annotated[str, Field(pattern=r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")] = "en"
    product_context: dict[str, Any] = Field(default_factory=dict)


class ModelInfo(BaseModel):
    name: str
    version: str | None = None


class Claim(BaseModel):
    claim_index: int
    claim_text: str
    support_status: Literal["SUPPORTED", "PARTIAL", "UNSUPPORTED", "NOT_APPLICABLE"]
    verifier_score: float | None = None
    citation_labels: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    label: str
    chunk_id: UUID
    authority: str
    document_title: str
    locator: str | None = None
    quoted_span: str | None = None
    source_url: str | None = None
    page_start: int | None = None
    page_end: int | None = None


class RagQueryResponse(BaseModel):
    retrieval_run_id: UUID | None
    corpus_version_id: UUID | None
    decision: Decision
    answer: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    model: ModelInfo
    policy_version: str
    claims: list[Claim] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    timings_ms: dict[str, int] = Field(default_factory=dict)


def get_rag_query_service() -> RagQueryService:
    return RagQueryService(PostgresCorpusRepository(get_engine()))


@router.post("/rag/query", response_model=RagQueryResponse)
async def rag_query(
    body: RagQueryRequest,
    _caller: ServiceCaller = Depends(require_service_token),
    service: RagQueryService = Depends(get_rag_query_service),
) -> RagQueryResponse:
    try:
        await service.answer(body.query, body.jurisdiction)
    except CorpusUnavailableError as error:
        raise ProblemError(503, "RAG_CORPUS_UNAVAILABLE", "Evidence corpus unavailable", str(error)) from None
    except RetrievalUnavailableError as error:
        raise ProblemError(503, "RAG_RETRIEVAL_UNAVAILABLE", "Evidence service unavailable", str(error)) from None
    raise ProblemError(503, "RAG_RETRIEVAL_UNAVAILABLE", "Evidence service unavailable", "No answer was produced.")
