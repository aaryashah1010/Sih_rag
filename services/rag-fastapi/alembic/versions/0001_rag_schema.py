"""rag schema baseline

Revision ID: 0001_rag_schema
Revises:
Create Date: 2026-09-29

Creates the FastAPI-owned rag schema from docs/07-DATABASE-SCHEMA.md sections 5 and 7.
The platform migration must already have created the rag schema, extensions and grants.
"""
from alembic import op

revision = "0001_rag_schema"
down_revision = None
branch_labels = None
depends_on = None

UPGRADE = """
CREATE TABLE rag.jurisdictions (
    code text PRIMARY KEY,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE rag.legal_domains (
    code text PRIMARY KEY,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE rag.sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key text NOT NULL UNIQUE,
    authority_name text NOT NULL,
    canonical_url text NOT NULL,
    jurisdiction_code text NOT NULL REFERENCES rag.jurisdictions(code),
    legal_domain_code text NOT NULL REFERENCES rag.legal_domains(code),
    source_type text NOT NULL CHECK (
        source_type IN ('LAW', 'RULE', 'REGULATION', 'TREATY', 'GUIDANCE', 'REGISTRY', 'CASE_LAW')
    ),
    access_policy text NOT NULL DEFAULT 'PUBLIC' CHECK (
        access_policy IN ('PUBLIC', 'POINTER_ONLY', 'RESTRICTED')
    ),
    refresh_policy text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_sources_updated_at
BEFORE UPDATE ON rag.sources
FOR EACH ROW EXECUTE FUNCTION audit.set_updated_at();

CREATE TABLE rag.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES rag.sources(id) ON DELETE RESTRICT,
    title text NOT NULL,
    instrument_type text,
    external_identifier text,
    canonical_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, external_identifier)
);

CREATE TABLE rag.document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES rag.documents(id) ON DELETE RESTRICT,
    sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    publication_date date,
    effective_from date,
    effective_to date,
    retrieved_at timestamptz NOT NULL,
    storage_uri text NOT NULL,
    extraction_method text CHECK (
        extraction_method IS NULL OR extraction_method IN ('HTML', 'PDF_TEXT', 'OCR', 'MANUAL')
    ),
    extraction_quality numeric(5,4) CHECK (
        extraction_quality IS NULL OR extraction_quality BETWEEN 0 AND 1
    ),
    parser_version text,
    status text NOT NULL DEFAULT 'STAGED' CHECK (
        status IN ('STAGED', 'VALIDATED', 'ACTIVE', 'RETIRED', 'REJECTED')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    UNIQUE (document_id, sha256)
);

CREATE TABLE rag.document_tags (
    document_id uuid NOT NULL REFERENCES rag.documents(id) ON DELETE CASCADE,
    tag text NOT NULL,
    PRIMARY KEY (document_id, tag)
);

CREATE TABLE rag.sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id uuid NOT NULL REFERENCES rag.document_versions(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES rag.sections(id) ON DELETE SET NULL,
    section_index integer NOT NULL CHECK (section_index >= 0),
    label text,
    heading text,
    level integer NOT NULL CHECK (level >= 0),
    page_start integer CHECK (page_start IS NULL OR page_start > 0),
    page_end integer CHECK (page_end IS NULL OR page_end > 0),
    CHECK (page_end IS NULL OR page_start IS NULL OR page_end >= page_start),
    UNIQUE (document_version_id, section_index)
);

CREATE TABLE rag.chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id uuid NOT NULL REFERENCES rag.document_versions(id) ON DELETE CASCADE,
    section_id uuid REFERENCES rag.sections(id) ON DELETE SET NULL,
    chunk_index integer NOT NULL CHECK (chunk_index >= 0),
    text text NOT NULL CHECK (length(btrim(text)) > 0),
    normalized_text text,
    token_count integer CHECK (token_count IS NULL OR token_count > 0),
    language varchar(16) NOT NULL DEFAULT 'en',
    low_quality boolean NOT NULL DEFAULT false,
    page_start integer CHECK (page_start IS NULL OR page_start > 0),
    page_end integer CHECK (page_end IS NULL OR page_end > 0),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(normalized_text, text))
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (page_end IS NULL OR page_start IS NULL OR page_end >= page_start),
    UNIQUE (document_version_id, chunk_index)
);

CREATE TABLE rag.chunk_embeddings (
    chunk_id uuid NOT NULL REFERENCES rag.chunks(id) ON DELETE CASCADE,
    model_name text NOT NULL,
    model_version text NOT NULL,
    embedding vector(768) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (chunk_id, model_name, model_version)
);

CREATE INDEX idx_chunks_version ON rag.chunks(document_version_id);
CREATE INDEX idx_chunks_section ON rag.chunks(section_id);
CREATE INDEX idx_chunks_metadata_gin ON rag.chunks USING gin(metadata);
CREATE INDEX idx_chunks_search_gin ON rag.chunks USING gin(search_vector);
CREATE INDEX idx_chunk_embeddings_hnsw ON rag.chunk_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE rag.corpus_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    manifest_uri text NOT NULL,
    manifest_sha256 char(64) NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
    embedding_model text NOT NULL,
    embedding_dimension integer NOT NULL CHECK (embedding_dimension > 0),
    status text NOT NULL CHECK (
        status IN ('BUILDING', 'VALIDATING', 'READY', 'ACTIVE', 'RETIRED', 'FAILED')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    activated_at timestamptz,
    retired_at timestamptz
);

CREATE UNIQUE INDEX uq_one_active_corpus ON rag.corpus_versions ((status)) WHERE status = 'ACTIVE';

CREATE TABLE rag.corpus_members (
    corpus_version_id uuid NOT NULL REFERENCES rag.corpus_versions(id) ON DELETE CASCADE,
    document_version_id uuid NOT NULL REFERENCES rag.document_versions(id) ON DELETE RESTRICT,
    PRIMARY KEY (corpus_version_id, document_version_id)
);

CREATE TABLE rag.ingestion_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by_user_id uuid,
    source_id uuid REFERENCES rag.sources(id) ON DELETE SET NULL,
    corpus_version_id uuid REFERENCES rag.corpus_versions(id) ON DELETE SET NULL,
    idempotency_key text UNIQUE,
    status text NOT NULL CHECK (
        status IN ('QUEUED', 'FETCHING', 'PARSING', 'EMBEDDING', 'VALIDATING', 'SUCCEEDED', 'FAILED', 'CANCELLED')
    ),
    counters jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_summary text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag.classifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    message_id uuid NOT NULL,
    category text NOT NULL,
    confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    legal_domains text[] NOT NULL DEFAULT '{}',
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    needs_more_info boolean NOT NULL DEFAULT false,
    model_version text,
    rules_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag.retrieval_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL UNIQUE,
    trace_id uuid NOT NULL,
    session_id uuid NOT NULL,
    message_id uuid NOT NULL,
    corpus_version_id uuid NOT NULL REFERENCES rag.corpus_versions(id) ON DELETE RESTRICT,
    query_hash char(64) NOT NULL CHECK (query_hash ~ '^[0-9a-f]{64}$'),
    query_text text,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    embedding_model text NOT NULL,
    reranker_model text,
    lexical_top_k integer NOT NULL CHECK (lexical_top_k > 0),
    vector_top_k integer NOT NULL CHECK (vector_top_k > 0),
    context_top_k integer NOT NULL CHECK (context_top_k > 0),
    duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
    status text NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'EMPTY', 'FAILED')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag.retrieval_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retrieval_run_id uuid NOT NULL REFERENCES rag.retrieval_runs(id) ON DELETE CASCADE,
    chunk_id uuid NOT NULL REFERENCES rag.chunks(id) ON DELETE RESTRICT,
    lexical_score double precision,
    vector_score double precision,
    fused_score double precision,
    rerank_score double precision,
    rank integer NOT NULL CHECK (rank > 0),
    selected_for_context boolean NOT NULL DEFAULT false,
    UNIQUE (retrieval_run_id, chunk_id),
    UNIQUE (retrieval_run_id, rank)
);

CREATE INDEX idx_classifications_message ON rag.classifications(message_id, created_at DESC);
CREATE INDEX idx_retrieval_runs_message ON rag.retrieval_runs(message_id, created_at DESC);
CREATE INDEX idx_retrieval_results_run_rank ON rag.retrieval_results(retrieval_run_id, rank);

CREATE TABLE rag.registry_queries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL,
    message_id uuid NOT NULL,
    adapter_name text NOT NULL,
    query_hash char(64) NOT NULL CHECK (query_hash ~ '^[0-9a-f]{64}$'),
    query_payload jsonb,
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'UNAVAILABLE', 'FAILED'))
);

CREATE TABLE rag.registry_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_query_id uuid NOT NULL REFERENCES rag.registry_queries(id) ON DELETE CASCADE,
    result_json jsonb NOT NULL,
    retrieved_at timestamptz NOT NULL,
    source_url text NOT NULL
);

INSERT INTO rag.jurisdictions (code, name) VALUES
    ('INDIA', 'India'),
    ('INTERNATIONAL', 'International treaties and WIPO/WTO/CBD instruments');

INSERT INTO rag.legal_domains (code, name) VALUES
    ('PATENT', 'Patents'),
    ('TRADITIONAL_KNOWLEDGE', 'Traditional knowledge'),
    ('TRADEMARK', 'Trade marks'),
    ('GEOGRAPHICAL_INDICATION', 'Geographical indications'),
    ('DESIGN', 'Industrial designs'),
    ('BIODIVERSITY_ABS', 'Biodiversity access and benefit sharing'),
    ('AYUSH_DRUG', 'Ayurveda, Siddha and Unani drugs'),
    ('AYURVEDA_AAHARA', 'Ayurveda Aahara food regulation'),
    ('COSMETICS', 'Cosmetics regulation'),
    ('ADVERTISING', 'Advertising and claims'),
    ('PLANT_VARIETY', 'Plant varieties and farmers rights'),
    ('COPYRIGHT', 'Copyright');
"""

DOWNGRADE = """
DROP TABLE IF EXISTS
    rag.registry_results, rag.registry_queries,
    rag.retrieval_results, rag.retrieval_runs, rag.classifications,
    rag.ingestion_runs, rag.corpus_members, rag.corpus_versions,
    rag.chunk_embeddings, rag.chunks, rag.sections,
    rag.document_tags, rag.document_versions, rag.documents, rag.sources,
    rag.legal_domains, rag.jurisdictions;
"""


def upgrade() -> None:
    op.execute(UPGRADE)


def downgrade() -> None:
    op.execute(DOWNGRADE)
