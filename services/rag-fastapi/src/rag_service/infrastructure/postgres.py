from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from rag_service.application.evidence_search import ActiveCorpusInfo
from rag_service.application.rag_query import ActiveCorpus


class PostgresCorpusRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def active_corpus(self) -> ActiveCorpus | None:
        async with self._engine.connect() as connection:
            row = (await connection.execute(text(
                "SELECT id, name, embedding_model FROM rag.corpus_versions WHERE status = 'ACTIVE'"
            ))).first()
        return ActiveCorpus(id=row.id, name=row.name, embedding_model=row.embedding_model) if row else None

    async def current(self) -> ActiveCorpusInfo | None:
        """Satisfies the ActiveCorpusLookup protocol used by EvidenceSearchService."""
        active = await self.active_corpus()
        return ActiveCorpusInfo(id=str(active.id), embedding_model=active.embedding_model) if active else None


async def database_reachable(engine: AsyncEngine) -> bool:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
