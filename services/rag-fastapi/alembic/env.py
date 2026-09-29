import os

from alembic import context
from sqlalchemy import create_engine, pool

from rag_service.config import sqlalchemy_url

url = os.environ.get("RAG_MIGRATION_DATABASE_URL")
if not url:
    raise RuntimeError("RAG_MIGRATION_DATABASE_URL is required to run RAG migrations")

engine = create_engine(sqlalchemy_url(url), poolclass=pool.NullPool)

with engine.connect() as connection:
    context.configure(
        connection=connection,
        version_table="rag_alembic_version",
        version_table_schema="migrations",
        transaction_per_migration=True,
    )
    with context.begin_transaction():
        context.run_migrations()
