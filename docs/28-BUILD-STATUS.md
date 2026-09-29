# Build Status

Tracks what actually exists in the repo against the plan in `19-IMPLEMENTATION-BACKLOG.md`.
Update this file, not the blueprint docs, as features land.

Last updated: 2026-09-30.

## Done

**P0.1 Repository/Docker foundation**
- `infra/docker/docker-compose.yml`: Postgres (pgvector image), one-shot migration
  containers (`db-platform`, `rag-migrate`, `api-migrate`), `rag-fastapi`, `api-node`,
  and an opt-in `corpus-loader` (profile `ingest`).
- Multi-stage, non-root Dockerfiles for both services. `rag-fastapi`'s API image stays
  free of `sentence-transformers`/torch; a separate `Dockerfile.ingest` carries those.

**P0.2 Database migrations**
- `infra/migrations/platform/001_platform.sql`: extensions, `app`/`rag`/`audit`/`migrations`
  schemas, `node_runtime`/`rag_runtime` roles, grants.
- `services/rag-fastapi/alembic/versions/0001_rag_schema.py`: full `rag` schema from
  `07-DATABASE-SCHEMA.md` §5/§7, plus seeded `jurisdictions`/`legal_domains`.
- `apps/api-node/migrations/0001_app_schema.sql`: full `app` schema from §6, run by a
  small Knex-based SQL migration runner (`src/db/migrate.ts`).

**P0.3 Node.js public API**
- JWT access tokens + rotating refresh tokens (reuse of a rotated token revokes its
  whole family). `bcrypt` password hashing, timing-safe login.
- `/api/v1/auth/{register,login,refresh,logout}`, `/api/v1/me`, session CRUD, message
  history, `/api/v1/chat`.
- `Idempotency-Key`/`client_message_id` on chat: a retried request returns the
  previously stored answer instead of calling FastAPI or the DB again.
- RFC 9457 Problem Details on every error path; structured `pino` logging with a
  request ID, never logging message bodies.
- `HttpRagClient` signs a short-lived internal service JWT (different secret/audience
  than the browser access token) and maps FastAPI outages/timeouts to 503/504 — a chat
  failure is never presented as an abstained answer.
- 10 Vitest tests against in-memory fakes (`src/app.test.ts`): auth, refresh rotation,
  session ownership isolation, idempotent chat, RAG-outage handling.

**P0.4 FastAPI RAG foundation**
- `/internal/v1/health`, `/internal/v1/ready` (reports DB + active-corpus state).
- `/internal/v1/rag/query`: validates the service JWT (issuer/audience/lifetime), then
  fails closed — `RAG_CORPUS_UNAVAILABLE` when no corpus is `ACTIVE`,
  `RAG_RETRIEVAL_UNAVAILABLE` otherwise. No answer is ever generated without evidence.
- 10 pytest tests (`tests/test_internal_api.py`): token rejection cases, schema
  validation, fail-closed behavior.

**P2.1 Escalations and consent**
- Added authenticated `POST /api/v1/escalations` and `GET /api/v1/escalations/:id`.
- Reused `app.escalations` and `app.consent_records`; creation and audit writes share a
  database transaction. USER reads are owner-scoped, EXPERT reads are assignment-scoped,
  and ADMIN cannot access case contents.
- Sensitive conversation, invention, and contact details require explicit
  `ESCALATION_REVIEW` consent. Audit events record consent/escalation metadata without
  case payloads. No database migration was needed.
- Added focused fake-backed API tests for consent, ownership/role access, strict input,
  Problem Details, audit data minimization, and transactional rollback.

**P1.1–P1.4 Ingestion**
- Source manifest, allowlisted fetcher, PDF/HTML parser, section/chunk builder (from
  the merged PR: `services/rag-fastapi/src/rag_service/ingestion/`).
- Fixed a section-mislabeling bug: amended sections with a footnote-bracket prefix
  (e.g. `7[14. Consideration...`) were parsed as belonging to the wrong section, and
  amendment-note lines (`3. Section 1`) were mistaken for top-level sections. The
  parser now requires section numbers to be non-decreasing and stops at `THE
  SCHEDULE`. Verified against the live Patents Act, 1970 PDF: only sections 95–98 and
  100 remain unmatched (these are repealed in the consolidated text, not a parser bug).

**P1.5 Embeddings + corpus loading (new this session)**
- `ports/embeddings.py`: `EmbeddingProvider` protocol.
- `infrastructure/embeddings/sentence_transformer.py`: local, open-source
  `sentence-transformers` adapter (default model `all-mpnet-base-v2`, 768-dim, matching
  the `vector(768)` migration invariant). Validates the model's actual dimension against
  the configured one and refuses to run on a mismatch.
- `application/corpus_loading.py` + `infrastructure/postgres/corpus_repository.py`:
  reads a finished ingestion run's `chunks.jsonl`/`corpus-manifest.json`, upserts
  `rag.sources`/`documents`/`document_versions`/`sections`/`chunks`, embeds and writes
  `rag.chunk_embeddings`, then walks `rag.corpus_versions` through
  `BUILDING -> READY -> (ACTIVE)`. Activation is atomic (retires the current `ACTIVE`
  row and activates the new one under a table lock) and only accepts a `READY` corpus.
  A document version whose `sha256` was already loaded is skipped (no re-embedding).
  Refuses to load a run whose manifest status isn't `NEEDS_REVIEW`.
- New CLI: `ipsakti-load-corpus --processed-dir <dir> [--activate]`.
- New Compose service `corpus-loader` (profile `ingest`, not part of default `up`)
  chains `ipsakti-ingest` and `ipsakti-load-corpus`.
- 5 pytest tests (`tests/test_corpus_loading.py`) against fakes: embed-once-per-version,
  skip-on-unchanged-sha256, refuse-non-`NEEDS_REVIEW` manifests, mark-`FAILED`-on-error,
  `READY`-without-`--activate`.
- **Not yet run against a live download + real embedding model in this session** — the
  logic is tested against fakes; an end-to-end run (`ipsakti-ingest` then
  `ipsakti-load-corpus --activate` inside `corpus-loader`) still needs to happen once,
  which also downloads the ~420MB model weights on first use.

**P1.6 Hybrid retrieval (new this session)**
- `ports/retrieval.py`: `ChunkRepository` protocol (`SearchQuery` in, ranked `EvidenceChunk`s out).
- `infrastructure/postgres/chunk_repository.py`: lexical search (`ts_rank` /
  `websearch_to_tsquery` over `rag.chunks.search_vector`) and vector search (pgvector
  cosine distance over `rag.chunk_embeddings`), both scoped to the `ACTIVE` corpus and an
  optional jurisdiction/legal-domain filter, normalized and fused with the
  0.45-vector/0.35-lexical weights from `08-RAG-AND-RETRIEVAL.md` §6 (the domain-boost
  term isn't implemented yet). Rejects a query when the active corpus was embedded with a
  different model than the service is configured for, rather than comparing incompatible
  vectors silently.
- `application/evidence_search.py` + new `POST /internal/v1/evidence/search` endpoint
  (`api/evidence.py`) — this is the endpoint already specified in
  `14-API-CONTRACT.md` §3. Returns ranked evidence with citation metadata; does not
  generate prose (that's P1.8, still not built, so `/rag/query` deliberately still fails
  closed rather than half-implementing generation).
- `embedding_runtime.py`: process-wide cached embedding model instance so the model loads
  once, not per request.
- Fixed a correctness bug caught in review before running anything: comparing an empty
  `legal_domains` array in SQL needs an explicit `::text[]` cast, and matching chunk UUIDs
  needs an explicit `::uuid[]` cast — without both, PostgreSQL raises a type-ambiguity or
  operator error rather than silently doing the wrong thing.
- 9 new pytest tests (`test_evidence_search.py`, `test_evidence_api.py`) against fakes.
- **Not yet run against live Postgres** — same caveat as P1.5: logic is tested against
  fakes only so far.

## Verified end-to-end (this session)

- Full Compose stack built and started: `postgres` (healthy) → `db-platform` →
  `rag-migrate` → `api-migrate` → `rag-fastapi` (healthy) → `api-node` (healthy).
- Smoke test through the public API only: register → login → create session → chat.
  Chat correctly returned `503 RAG_CORPUS_UNAVAILABLE` (no corpus loaded yet) instead
  of a fabricated answer.
- `ipsakti-ingest` ran against the live IP India site (both Patents Act sources
  downloaded, checksummed, parsed into 211 chunks).

## Not started

Everything from the cross-encoder reranker (P1.7) onward: grounded generation, the
citation verifier, the chat UI, and all of Phases 2–7 (classification, live registries,
international corpus, multilingual/voice, knowledge graph, production hardening).
