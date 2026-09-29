-- Node.js-owned app schema (docs/07-DATABASE-SCHEMA.md section 6).
-- Requires the platform migration and the rag schema migration (citations and answers reference rag tables).

CREATE TABLE app.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    organization_type text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES app.organizations(id) ON DELETE SET NULL,
    email text,
    display_name text,
    preferred_language varchar(16) NOT NULL DEFAULT 'en',
    role text NOT NULL DEFAULT 'USER' CHECK (
        role IN ('USER', 'EXPERT', 'ADMIN', 'INGESTION_SERVICE', 'EVALUATION')
    ),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'DISABLED', 'DELETED')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email_lower
ON app.users (lower(email))
WHERE email IS NOT NULL AND status <> 'DELETED';

-- Credentials are kept apart from profile rows so profile reads never load password hashes.
CREATE TABLE app.user_credentials (
    user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
    password_hash text NOT NULL,
    password_updated_at timestamptz NOT NULL DEFAULT now()
);

-- Opaque refresh tokens, stored as SHA-256 hashes and rotated on every use.
-- Presenting a revoked token revokes its whole family (reuse detection).
CREATE TABLE app.refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    family_id uuid NOT NULL,
    token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    replaced_by_id uuid REFERENCES app.refresh_tokens(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_family ON app.refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user ON app.refresh_tokens(user_id);

CREATE TABLE app.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
    title text,
    jurisdiction_code text NOT NULL DEFAULT 'INDIA' CHECK (jurisdiction_code IN ('INDIA', 'INTERNATIONAL')),
    language varchar(16) NOT NULL DEFAULT 'en',
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'ARCHIVED', 'DELETED')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES app.sessions(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    content text NOT NULL CHECK (length(btrim(content)) > 0),
    language varchar(16),
    client_message_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, client_message_id)
);

CREATE INDEX idx_sessions_user_updated ON app.sessions(user_id, updated_at DESC, id DESC);
CREATE INDEX idx_messages_session_created ON app.messages(session_id, created_at, id);

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON app.organizations
FOR EACH ROW EXECUTE FUNCTION audit.set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON app.users
FOR EACH ROW EXECUTE FUNCTION audit.set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON app.sessions
FOR EACH ROW EXECUTE FUNCTION audit.set_updated_at();

CREATE TABLE app.answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_message_id uuid NOT NULL UNIQUE REFERENCES app.messages(id) ON DELETE RESTRICT,
    assistant_message_id uuid UNIQUE REFERENCES app.messages(id) ON DELETE RESTRICT,
    retrieval_run_id uuid,
    corpus_version_id uuid REFERENCES rag.corpus_versions(id) ON DELETE RESTRICT,
    model_name text NOT NULL,
    model_version text,
    policy_version text NOT NULL,
    decision text NOT NULL CHECK (
        decision IN ('PASS', 'PASS_WITH_CAUTION', 'ABSTAIN', 'ESCALATE')
    ),
    confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    answer_text text NOT NULL,
    missing_information jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.answer_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id uuid NOT NULL REFERENCES app.answers(id) ON DELETE CASCADE,
    claim_index integer NOT NULL CHECK (claim_index >= 0),
    claim_text text NOT NULL,
    support_status text NOT NULL CHECK (
        support_status IN ('SUPPORTED', 'PARTIAL', 'UNSUPPORTED', 'NOT_APPLICABLE')
    ),
    verifier_score numeric(5,4) CHECK (verifier_score IS NULL OR verifier_score BETWEEN 0 AND 1),
    UNIQUE (answer_id, claim_index),
    UNIQUE (id, answer_id)
);

CREATE TABLE app.citations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id uuid NOT NULL REFERENCES app.answers(id) ON DELETE CASCADE,
    claim_id uuid,
    chunk_id uuid NOT NULL REFERENCES rag.chunks(id) ON DELETE RESTRICT,
    citation_label text NOT NULL,
    authority_snapshot text NOT NULL,
    document_title_snapshot text NOT NULL,
    locator_snapshot text,
    quoted_span text,
    source_url_snapshot text,
    page_start integer,
    page_end integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (claim_id, answer_id) REFERENCES app.answer_claims(id, answer_id) ON DELETE CASCADE,
    UNIQUE (answer_id, citation_label),
    CHECK (page_end IS NULL OR page_start IS NULL OR page_end >= page_start)
);

CREATE INDEX idx_answers_created ON app.answers(created_at DESC);
CREATE INDEX idx_citations_chunk ON app.citations(chunk_id);

CREATE TABLE app.consent_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    purpose text NOT NULL,
    notice_version text NOT NULL,
    granted boolean NOT NULL,
    granted_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT granted OR granted_at IS NOT NULL)
);

CREATE TABLE app.escalations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id uuid REFERENCES app.answers(id) ON DELETE SET NULL,
    user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
    assigned_expert_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
    consent_record_id uuid REFERENCES app.consent_records(id) ON DELETE RESTRICT,
    reason text NOT NULL,
    case_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'CANCELLED')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalations_assignee_status ON app.escalations(assigned_expert_id, status, created_at);

CREATE TRIGGER trg_escalations_updated_at
BEFORE UPDATE ON app.escalations
FOR EACH ROW EXECUTE FUNCTION audit.set_updated_at();
