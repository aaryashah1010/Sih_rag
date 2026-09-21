# PostgreSQL Database Schema

## 1. Database choice

Use PostgreSQL as the system of record.

Use `pgvector` for embeddings.

Why:

- transactional metadata;
- audit logs;
- user/session state;
- structured source versioning;
- vector search without another mandatory database;
- simpler deployment for the MVP.

## 2. Core entities

```text
users
organizations
sessions
messages

sources
documents
document_versions
sections
chunks
chunk_embeddings

legal_domains
jurisdictions
document_tags

classifications
query_routes
retrieval_runs
retrieval_results

answers
answer_claims
citations
confidence_scores

registry_queries
registry_results
escalations

ingestion_runs
corpus_versions

language_runs
consent_records
audit_logs

evaluation_cases
evaluation_runs
evaluation_results
```

## 3. Suggested DDL

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT,
    organization_id UUID,
    role TEXT NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    organization_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jurisdictions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE legal_domains (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE sources (
    id UUID PRIMARY KEY,
    source_key TEXT UNIQUE NOT NULL,
    authority_name TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    jurisdiction_code TEXT,
    legal_domain_code TEXT,
    source_type TEXT NOT NULL,
    access_policy TEXT NOT NULL DEFAULT 'PUBLIC',
    refresh_policy TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY,
    source_id UUID NOT NULL REFERENCES sources(id),
    title TEXT NOT NULL,
    instrument_type TEXT,
    external_identifier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id),
    sha256 TEXT NOT NULL,
    publication_date DATE,
    effective_from DATE,
    effective_to DATE,
    retrieved_at TIMESTAMPTZ NOT NULL,
    storage_uri TEXT NOT NULL,
    extraction_method TEXT,
    parser_version TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    UNIQUE(document_id, sha256)
);

CREATE TABLE sections (
    id UUID PRIMARY KEY,
    document_version_id UUID NOT NULL REFERENCES document_versions(id),
    parent_id UUID REFERENCES sections(id),
    label TEXT,
    heading TEXT,
    level INT NOT NULL,
    page_start INT,
    page_end INT
);

CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    section_id UUID REFERENCES sections(id),
    document_version_id UUID NOT NULL REFERENCES document_versions(id),
    chunk_index INT NOT NULL,
    text TEXT NOT NULL,
    normalized_text TEXT,
    token_count INT,
    language TEXT NOT NULL DEFAULT 'en',
    low_quality BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE chunk_embeddings (
    chunk_id UUID PRIMARY KEY REFERENCES chunks(id),
    embedding vector(768),
    model_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE corpus_versions (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    manifest_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    status TEXT NOT NULL
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    jurisdiction_code TEXT,
    language TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE classifications (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    message_id UUID NOT NULL REFERENCES messages(id),
    category TEXT NOT NULL,
    confidence NUMERIC(5,4),
    evidence JSONB NOT NULL DEFAULT '{}',
    needs_more_info BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_runs (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    message_id UUID NOT NULL REFERENCES messages(id),
    query_text TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    embedding_model TEXT,
    reranker_model TEXT,
    top_k INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_results (
    id UUID PRIMARY KEY,
    retrieval_run_id UUID NOT NULL REFERENCES retrieval_runs(id),
    chunk_id UUID NOT NULL REFERENCES chunks(id),
    lexical_score DOUBLE PRECISION,
    vector_score DOUBLE PRECISION,
    rerank_score DOUBLE PRECISION,
    rank INT NOT NULL
);

CREATE TABLE answers (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id),
    model_name TEXT,
    model_version TEXT,
    policy_version TEXT,
    corpus_version_id UUID REFERENCES corpus_versions(id),
    answer_text TEXT NOT NULL,
    decision TEXT NOT NULL,
    confidence NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE answer_claims (
    id UUID PRIMARY KEY,
    answer_id UUID NOT NULL REFERENCES answers(id),
    claim_index INT NOT NULL,
    claim_text TEXT NOT NULL,
    support_status TEXT NOT NULL,
    verifier_score NUMERIC(5,4)
);

CREATE TABLE citations (
    id UUID PRIMARY KEY,
    answer_id UUID NOT NULL REFERENCES answers(id),
    claim_id UUID REFERENCES answer_claims(id),
    chunk_id UUID NOT NULL REFERENCES chunks(id),
    citation_label TEXT NOT NULL,
    quoted_span TEXT,
    page_start INT,
    page_end INT
);

CREATE TABLE registry_queries (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id),
    adapter_name TEXT NOT NULL,
    query_payload JSONB NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL
);

CREATE TABLE registry_results (
    id UUID PRIMARY KEY,
    registry_query_id UUID NOT NULL REFERENCES registry_queries(id),
    result_json JSONB NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL,
    source_url TEXT
);

CREATE TABLE escalations (
    id UUID PRIMARY KEY,
    answer_id UUID REFERENCES answers(id),
    reason TEXT NOT NULL,
    case_payload JSONB NOT NULL,
    consent_record_id UUID,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE language_runs (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id),
    source_language TEXT,
    target_language TEXT,
    asr_provider TEXT,
    translation_provider TEXT,
    tts_provider TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_records (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    purpose TEXT NOT NULL,
    consent_text_version TEXT NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor_type TEXT NOT NULL,
    actor_id UUID,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    event_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_document_version ON chunks(document_version_id);
CREATE INDEX idx_chunks_metadata ON chunks USING GIN(metadata);
CREATE INDEX idx_retrieval_results_run_rank ON retrieval_results(retrieval_run_id, rank);
CREATE INDEX idx_answers_session_created ON answers(message_id, created_at);
```

## 4. Vector dimension

The schema shows `vector(768)` as the baseline only. This must be changed if the selected embedding model has a different dimension.

Make model dimension a migration/config invariant:

```yaml
embedding:
  model: <selected-model>
  dimension: 768
```

On startup:

1. load model metadata;
2. compare configured dimension to DB dimension;
3. fail fast with an actionable migration message.

## 5. Full-text search

For MVP, use PostgreSQL full-text search:

```sql
ALTER TABLE chunks
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(normalized_text, text))
) STORED;

CREATE INDEX idx_chunks_search_vector
ON chunks USING GIN(search_vector);
```

For better domain search later, consider Elasticsearch/OpenSearch.

## 6. Entity relationships

```text
Source 1---N Document
Document 1---N DocumentVersion
DocumentVersion 1---N Section
Section 1---N Chunk
Chunk 1---1 Embedding

Message 1---N RetrievalRun
RetrievalRun 1---N RetrievalResult
Message 1---1 Answer
Answer 1---N Claim
Claim 1---N Citation
Citation N---1 Chunk
```
