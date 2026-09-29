from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    rag_env: str = "development"
    rag_database_url: str = "postgresql://rag_runtime:rag_dev_password@postgres:5432/ipsakti"
    rag_service_token_secret: str = Field(min_length=32)
    service_token_issuer: str = "ipsakti-api-node"
    service_token_audience: str = "ipsakti-rag-internal"
    service_token_max_lifetime_seconds: int = 300
    log_level: str = "INFO"

    # docs/20-CONFIG-SPEC.md. 768 is the rag.chunk_embeddings migration invariant; changing the
    # model to a different dimension requires a new migration, not just a config change.
    embedding_model: str = "sentence-transformers/all-mpnet-base-v2"
    embedding_dimension: int = 768


@lru_cache
def get_settings() -> Settings:
    return Settings()


def sqlalchemy_url(url: str) -> str:
    """Use the psycopg 3 driver for plain postgresql:// URLs shared with other tools."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url
