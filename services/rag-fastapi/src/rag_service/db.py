from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from rag_service.config import get_settings, sqlalchemy_url

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            sqlalchemy_url(get_settings().rag_database_url),
            pool_size=5,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5},
        )
    return _engine


async def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
