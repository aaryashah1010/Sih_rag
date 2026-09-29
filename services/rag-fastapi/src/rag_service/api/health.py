from fastapi import APIRouter
from fastapi.responses import JSONResponse

from rag_service.db import get_engine
from rag_service.infrastructure.postgres import PostgresCorpusRepository, database_reachable

router = APIRouter(prefix="/internal/v1", tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready() -> JSONResponse:
    """Ready means the database is reachable. Corpus state is reported so callers can explain chat outages."""
    engine = get_engine()
    if not await database_reachable(engine):
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unavailable"})
    corpus = await PostgresCorpusRepository(engine).active_corpus()
    return JSONResponse(content={
        "status": "ok",
        "database": "ok",
        "active_corpus": corpus.name if corpus else None,
    })
