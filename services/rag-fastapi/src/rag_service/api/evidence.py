from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from rag_service.api.problems import ProblemError
from rag_service.api.security import ServiceCaller, require_service_token
from rag_service.application.evidence_search import EvidenceSearchRequest, EvidenceSearchService, NoActiveCorpusError
from rag_service.db import get_engine
from rag_service.embedding_runtime import get_embedding_provider
from rag_service.infrastructure.postgres import PostgresCorpusRepository
from rag_service.infrastructure.postgres.chunk_repository import PostgresChunkRepository

router = APIRouter(prefix="/internal/v1", tags=["evidence"])


class EvidenceSearchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: Annotated[str, Field(min_length=1, max_length=2000)]
    jurisdiction: Literal["INDIA", "INTERNATIONAL"]
    legal_domains: list[str] = Field(default_factory=list)
    limit: Annotated[int, Field(ge=1, le=50)] = 10


class EvidenceResult(BaseModel):
    chunk_id: str
    document_title: str
    authority: str
    section_label: str | None
    source_url: str | None
    jurisdiction: str
    legal_domain: str
    language: str
    page_start: int | None
    page_end: int | None
    low_quality: bool
    text: str
    lexical_score: float | None
    vector_score: float | None
    fused_score: float
    rank: int


class EvidenceSearchResponse(BaseModel):
    corpus_version_id: str
    results: list[EvidenceResult]


def get_evidence_search_service() -> EvidenceSearchService:
    engine = get_engine()
    return EvidenceSearchService(
        PostgresCorpusRepository(engine), PostgresChunkRepository(engine), get_embedding_provider()
    )


@router.post("/evidence/search", response_model=EvidenceSearchResponse)
async def search_evidence(
    body: EvidenceSearchBody,
    _caller: ServiceCaller = Depends(require_service_token),
    service: EvidenceSearchService = Depends(get_evidence_search_service),
) -> EvidenceSearchResponse:
    try:
        result = await service.search(EvidenceSearchRequest(
            query_text=body.query, jurisdiction=body.jurisdiction,
            legal_domains=tuple(body.legal_domains), context_top_k=body.limit,
        ))
    except NoActiveCorpusError as error:
        raise ProblemError(503, "RAG_CORPUS_UNAVAILABLE", "Evidence corpus unavailable", str(error)) from None

    return EvidenceSearchResponse(
        corpus_version_id=result.corpus_version_id,
        results=[
            EvidenceResult(
                chunk_id=chunk.chunk_id, document_title=chunk.document_title, authority=chunk.authority,
                section_label=chunk.section_label, source_url=chunk.source_url, jurisdiction=chunk.jurisdiction,
                legal_domain=chunk.legal_domain, language=chunk.language, page_start=chunk.page_start,
                page_end=chunk.page_end, low_quality=chunk.low_quality, text=chunk.text,
                lexical_score=chunk.lexical_score, vector_score=chunk.vector_score,
                fused_score=chunk.fused_score, rank=chunk.rank,
            )
            for chunk in result.results
        ],
    )
