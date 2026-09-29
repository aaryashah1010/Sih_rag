from typing import Protocol


class EmbeddingProvider(Protocol):
    """Adapter boundary for embedding text into vectors of a fixed dimension.

    Implementations live in infrastructure/ (design pattern: adapter). The ingestion/RAG
    application layer depends only on this protocol, never on a specific model library.
    """

    model_name: str
    model_version: str
    dimension: int

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding per input text, in the same order. Never mutates `texts`."""
        ...
