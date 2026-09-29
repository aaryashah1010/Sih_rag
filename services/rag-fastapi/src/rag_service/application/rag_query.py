from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class ActiveCorpus:
    id: UUID
    name: str
    embedding_model: str


class CorpusRepository(Protocol):
    async def active_corpus(self) -> ActiveCorpus | None: ...


class CorpusUnavailableError(Exception):
    """No validated corpus is active, so no evidence can be retrieved."""


class RetrievalUnavailableError(Exception):
    """The retrieval stage cannot run; the caller must not receive a generated answer."""


class RagQueryService:
    def __init__(self, corpus_repository: CorpusRepository) -> None:
        self._corpus_repository = corpus_repository

    async def answer(self, query: str, jurisdiction: str) -> None:
        corpus = await self._corpus_repository.active_corpus()
        if corpus is None:
            raise CorpusUnavailableError("No validated legal corpus is active.")
        # Hybrid retrieval, reranking, grounded generation and verification land in backlog P1.6-P1.9.
        # Until then the service fails closed instead of answering without evidence.
        raise RetrievalUnavailableError("Evidence retrieval is not enabled in this build.")
