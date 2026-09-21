# DevOps and Deployment

## 1. Repository structure

```text
/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   ├── ingestion/
│   ├── retrieval/
│   ├── classification/
│   ├── agents/
│   ├── registries/
│   ├── language/
│   └── verification/
├── data/
│   ├── manifests/
│   ├── evaluation/
│   └── samples/
├── infra/
│   ├── docker/
│   ├── nginx/
│   ├── postgres/
│   └── monitoring/
├── migrations/
├── tests/
├── scripts/
└── docs/
```

## 2. Local development

Use Docker Compose for:

```text
web
api
postgres
redis (optional)
minio (optional)
neo4j (optional)
model-service (optional)
```

## 3. Environment

Create:

```text
.env.example
.env.local
```

Never commit real secrets.

## 4. CI/CD

Pipeline:

```text
push
 ↓
lint
 ↓
unit tests
 ↓
type checks
 ↓
security scan
 ↓
API integration tests
 ↓
retrieval regression
 ↓
Docker build
 ↓
migration check
 ↓
deploy staging
 ↓
smoke test
 ↓
production/demo deploy
```

## 5. Image policy

Pin base images by major/minor version.

Avoid `latest`.

## 6. Database migration

Deployment sequence:

```text
backup
 ↓
apply forward-compatible migration
 ↓
deploy app
 ↓
run smoke tests
```

Never drop columns in the same deploy that removes application usage unless rollback strategy is proven.

## 7. Object storage

Store raw official files:

```text
/raw/{source_key}/{document_hash}/original.ext
/raw/{source_key}/{document_hash}/parsed.json
/raw/{source_key}/{document_hash}/ocr.json
```

## 8. Monitoring

Metrics:

```text
request_count
error_rate
latency_p50/p95
retrieval_empty_rate
abstention_rate
citation_failure_rate
registry_failure_rate
language_failure_rate
ingestion_failure_rate
db_latency
model_latency
```

## 9. Tracing

Every request gets:

```text
trace_id
session_id
message_id
retrieval_run_id
answer_id
```

## 10. Backups

Minimum:

- daily PostgreSQL backup;
- object storage versioning;
- corpus manifest backups;
- source hashes.

Test restore before relying on it.

## 11. Production hardening

Before real users:

- HTTPS;
- WAF/rate limiting;
- secure cookies where applicable;
- secret manager;
- dependency scanning;
- PDF sandboxing;
- database network isolation;
- role-based admin console.
