-- Platform migration: extensions, schemas, runtime roles, shared functions and the audit schema.
-- Runs as the migration owner before any service migration. Every statement is idempotent.
-- Runtime role passwords are supplied as psql variables (node_pw, rag_pw) from deployment secrets.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS rag;
CREATE SCHEMA IF NOT EXISTS audit;
-- Migration bookkeeping (Knex and Alembic version tables). Runtime roles get no access.
CREATE SCHEMA IF NOT EXISTS migrations;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

SELECT 'CREATE ROLE node_runtime LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'node_runtime')\gexec
SELECT 'CREATE ROLE rag_runtime LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rag_runtime')\gexec

ALTER ROLE node_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'node_pw';
ALTER ROLE rag_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'rag_pw';

-- Each runtime role resolves unqualified names inside its own schema only.
ALTER ROLE node_runtime SET search_path = app;
ALTER ROLE rag_runtime SET search_path = rag;

CREATE OR REPLACE FUNCTION audit.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS audit.events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    trace_id uuid,
    request_id uuid,
    actor_type text NOT NULL CHECK (
        actor_type IN ('USER', 'EXPERT', 'ADMIN', 'NODE_API', 'RAG_SERVICE', 'WORKER', 'SYSTEM')
    ),
    actor_id uuid,
    event_type text NOT NULL,
    entity_type text,
    entity_id uuid,
    outcome text,
    event_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit.events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_trace ON audit.events(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit.events(entity_type, entity_id)
WHERE entity_id IS NOT NULL;

-- Schema usage. Neither runtime role can create objects anywhere.
REVOKE ALL ON SCHEMA app, rag, audit, migrations FROM PUBLIC;
GRANT USAGE ON SCHEMA app, audit TO node_runtime;
GRANT USAGE ON SCHEMA rag, audit TO rag_runtime;

-- Audit is append-only for both services.
REVOKE ALL ON audit.events FROM node_runtime, rag_runtime;
GRANT INSERT ON audit.events TO node_runtime, rag_runtime;

-- Tables created later by the migration owner in each service schema are granted automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO node_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO node_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rag_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT USAGE, SELECT ON SEQUENCES TO rag_runtime;

-- Re-apply grants to tables that already exist so a re-run repairs drift.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO node_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO node_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rag TO rag_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rag TO rag_runtime;
