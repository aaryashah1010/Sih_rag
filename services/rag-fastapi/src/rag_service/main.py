from fastapi import FastAPI

from rag_service.api.health import router as health_router

app = FastAPI(title="IP-SAKTI RAG Service", version="0.1.0")
app.include_router(health_router)
