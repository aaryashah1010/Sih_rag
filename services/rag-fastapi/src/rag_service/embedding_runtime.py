from functools import lru_cache

from rag_service.config import get_settings
from rag_service.infrastructure.embeddings.sentence_transformer import SentenceTransformerEmbeddingProvider


@lru_cache
def get_embedding_provider() -> SentenceTransformerEmbeddingProvider:
    """Loads the model once per process. FastAPI's Depends() caches nothing across requests,
    so callers must go through this cache rather than constructing the provider directly."""
    settings = get_settings()
    return SentenceTransformerEmbeddingProvider(settings.embedding_model, settings.embedding_dimension)
