import argparse
import asyncio
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine

from rag_service.application.corpus_loading import CorpusLoadError, CorpusLoadingService
from rag_service.config import get_settings, sqlalchemy_url
from rag_service.infrastructure.embeddings.sentence_transformer import SentenceTransformerEmbeddingProvider
from rag_service.infrastructure.postgres.corpus_repository import PostgresCorpusRepository


async def _run(processed_dir: Path, activate: bool) -> None:
    settings = get_settings()
    engine = create_async_engine(sqlalchemy_url(settings.rag_database_url), pool_pre_ping=True)
    try:
        embeddings = SentenceTransformerEmbeddingProvider(settings.embedding_model, settings.embedding_dimension)
        service = CorpusLoadingService(PostgresCorpusRepository(engine), embeddings)
        result = await service.load(processed_dir, activate=activate)
    finally:
        await engine.dispose()

    print(f"Corpus loaded: {result.corpus_name} ({result.corpus_version_id})")
    print(f"Document versions: {result.document_versions_loaded} loaded, {result.document_versions_unchanged} unchanged")
    print(f"Chunks embedded: {result.chunks_embedded}")
    print(f"Status: {'ACTIVE' if result.activated else 'READY (not activated; pass --activate)'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed an ingested corpus and load it into PostgreSQL + pgvector")
    parser.add_argument("--processed-dir", type=Path, required=True, help="e.g. data/processed/india-patent-mvp-2026-09-28-v1")
    parser.add_argument("--activate", action="store_true", help="Also activate this corpus (retires the current ACTIVE corpus)")
    arguments = parser.parse_args()

    try:
        asyncio.run(_run(arguments.processed_dir, arguments.activate))
    except CorpusLoadError as error:
        raise SystemExit(f"error: {error}") from None


if __name__ == "__main__":
    main()
