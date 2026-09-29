"""Local open-source embedding adapter (ADR-002: no unpublished invention text leaves the system).

Used both at ingestion time (batch-embed a corpus) and at query time (embed the incoming
question), so `sentence-transformers` is a core dependency of this service, not optional.
The import is still deferred to construction time so importing this module stays cheap
wherever the provider itself isn't needed (e.g. most unit tests use a fake instead).
"""

MODEL_VERSION = "1"


class SentenceTransformerEmbeddingProvider:
    model_name: str
    model_version: str = MODEL_VERSION
    dimension: int

    def __init__(self, model_name: str, expected_dimension: int) -> None:
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        self.dimension = self._model.get_sentence_embedding_dimension()
        if self.dimension != expected_dimension:
            raise ValueError(
                f"Embedding model '{model_name}' produces {self.dimension}-dimensional vectors, "
                f"but the database migration expects {expected_dimension}. Change the model or "
                "migrate rag.chunk_embeddings to the new dimension before ingesting."
            )

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(texts, batch_size=16, show_progress_bar=False, normalize_embeddings=True)
        return vectors.tolist()
