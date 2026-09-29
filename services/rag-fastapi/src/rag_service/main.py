import logging
import re
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from rag_service.api.evidence import router as evidence_router
from rag_service.api.health import router as health_router
from rag_service.api.problems import install_problem_handlers
from rag_service.api.rag import router as rag_router
from rag_service.config import get_settings
from rag_service.db import dispose_engine

logger = logging.getLogger("rag_service")
REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logging.basicConfig(level=get_settings().log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    yield
    await dispose_engine()


app = FastAPI(title="IP-SAKTI RAG Service", version="0.1.0", lifespan=lifespan)
install_problem_handlers(app)
app.include_router(health_router)
app.include_router(rag_router)
app.include_router(evidence_router)


@app.middleware("http")
async def correlate(request: Request, call_next):
    incoming = request.headers.get("x-request-id", "")
    request.state.request_id = incoming if REQUEST_ID.fullmatch(incoming) else str(uuid.uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    # Log metadata only; request bodies may contain confidential invention details.
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%d",
        request.state.request_id,
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response
