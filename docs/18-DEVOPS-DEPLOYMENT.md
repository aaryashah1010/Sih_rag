# DevOps and Deployment

## 1. Repository structure

```text
/
|-- apps/
|   |-- web/                    React/Vite/Tailwind
|   `-- api-node/               public API and normal application I/O
|-- services/
|   `-- rag-fastapi/            RAG, ingestion, models and verification
|       |-- src/
|       |-- alembic/
|       `-- tests/
|-- data/
|   |-- manifests/
|   |-- evaluation/
|   `-- samples/
|-- infra/
|   |-- docker/
|   |-- nginx/
|   |-- migrations/
|   |-- postgres/
|   `-- monitoring/
|-- tests/
|   |-- contract/
|   `-- end-to-end/
|-- scripts/
`-- docs/
```

Node.js and FastAPI remain independently buildable and testable. Shared code is limited to language-neutral API schemas generated from OpenAPI/JSON Schema; do not share framework-specific runtime modules between JavaScript/TypeScript and Python.

## 2. Docker Compose topology

Required MVP services:

```text
reverse-proxy
web
api-node
rag-fastapi
postgres (pgvector enabled)
model-runtime
```

Optional services:

```text
redis          task queue, cache or distributed rate limiting
minio          local S3-compatible object storage
worker         separate ingestion worker
neo4j          Phase 2/3 only
```

Network rules:

- `web` reaches only the public Node.js route through the reverse proxy.
- `api-node` can reach `rag-fastapi` and PostgreSQL.
- `rag-fastapi` can reach PostgreSQL, object storage, model runtime and allowlisted external sources.
- PostgreSQL, FastAPI and model-runtime have no public ingress.
- health checks use dedicated health endpoints and `pg_isready`.

## 3. Local startup order

```text
PostgreSQL healthy
  -> platform migrations
  -> Node.js app migrations
  -> FastAPI RAG migrations
  -> FastAPI ready
  -> Node.js ready
  -> web/reverse proxy ready
```

Compose `depends_on` alone is not a readiness guarantee. Containers must retry dependency connection with bounded backoff and expose readiness only after mandatory dependencies are usable.

## 4. Environment files

Commit only `.env.example`. Keep local values in ignored `.env.local` files and deployment values in a secret store.

Node.js needs:

```text
NODE_ENV
PORT
DATABASE_URL
RAG_SERVICE_URL
RAG_SERVICE_TOKEN
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
PUBLIC_ORIGIN
```

FastAPI needs:

```text
APP_ENV
PORT
RAG_DATABASE_URL
SERVICE_TOKEN_PUBLIC_KEY
OBJECT_STORAGE_URL
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
LLM_BASE_URL
LLM_MODEL
EMBEDDING_MODEL
RERANKER_MODEL
BHASHINI_INFERENCE_API_KEY
```

Never place a browser-visible `VITE_*` prefix on server credentials.

## 5. Docker image policy

- Pin base images by exact version and pin the final demo images by digest.
- Use multi-stage builds and non-root runtime users.
- Keep Node.js production dependencies separate from dev dependencies.
- Use a slim Python runtime but include system packages required by OCR/PDF libraries.
- Add image vulnerability and dependency scans in CI.
- Do not bake models, source documents or secrets into the API images unless the deployment plan explicitly requires an offline bundle.

## 6. CI/CD pipeline

```text
install with lockfiles
  -> format/lint
  -> Node.js type check and unit tests
  -> Python lint/type check and unit tests
  -> OpenAPI compatibility tests
  -> start PostgreSQL + pgvector
  -> apply migrations from empty database
  -> integration and retrieval regression tests
  -> security/dependency scans
  -> build Docker images
  -> start complete Compose stack
  -> end-to-end smoke test
  -> publish versioned images
  -> deploy staging/demo
```

The pipeline fails if migrations drift, OpenAPI examples are invalid, a RAG answer has unsupported citations, or the browser can access the internal FastAPI route.

## 7. Database deployment

Deployment sequence:

```text
verified backup
  -> forward-compatible platform migration
  -> RAG/app schema migrations
  -> deploy FastAPI
  -> deploy Node.js
  -> smoke tests
  -> activate new corpus separately
```

Database migrations and corpus activation are separate operations. A code deploy must not automatically replace the active legal corpus.

Use expand-and-contract migrations for breaking changes. Do not drop a column in the same release that removes its final reader unless rollback has been tested.

## 8. Object storage layout

```text
/raw/{source_key}/{sha256}/original.ext
/parsed/{source_key}/{sha256}/document.json
/ocr/{source_key}/{sha256}/ocr.json
/manifests/{corpus_version}/manifest.json
```

Use immutable object keys and verify checksums after upload/download. PostgreSQL stores the object URI and hash.

## 9. Health and observability

Node.js readiness requires PostgreSQL and, for the chat capability, a healthy FastAPI service. FastAPI readiness requires PostgreSQL, the active corpus and required local model endpoints.

Core metrics:

```text
http_requests_total
http_request_duration_ms
node_to_rag_duration_ms
retrieval_empty_rate
retrieval_duration_ms
reranker_duration_ms
model_duration_ms
abstention_rate
citation_failure_rate
registry_failure_rate
ingestion_failure_rate
db_pool_wait_ms
```

Propagate `trace_id`, `request_id`, `session_id`, `message_id`, `retrieval_run_id` and `answer_id`. Do not emit raw confidential prompts in ordinary logs.

## 10. Backups and recovery

- Daily PostgreSQL backup plus a backup immediately before migrations.
- Object-storage versioning and corpus manifest backups.
- Recovery runbook with stated RPO/RTO for the demo and production targets.
- Restore drill into a clean environment.
- Verify record counts, source checksums, active corpus, vector rows and citation links after restore.

## 11. SIH demo deployment checklist

1. Pin all images, models and lockfiles.
2. Pre-download model weights and required corpus artifacts.
3. Prepare a tested offline or low-connectivity mode for corpus-only questions.
4. Seed a validated demo corpus and evaluation questions.
5. Verify GPU/CPU memory and cold-start time on the actual demo machine.
6. Disable unfinished admin and registry features with feature flags.
7. Run a full backup and restore rehearsal.
8. Run the golden chat flow, abstention flow and citation-link check.
9. Confirm no FastAPI, PostgreSQL or model port is publicly exposed.
10. Keep a versioned rollback Compose file and previous images available.

## 12. Production hardening

Before real users: enable HTTPS, secure cookies where used, WAF/rate limiting, secret rotation, PDF sandboxing, strict egress allowlists, database network isolation, role-based admin access, retention jobs, alerting and an incident response process. Obtain a legal/privacy review before accepting confidential invention data at production scale.
