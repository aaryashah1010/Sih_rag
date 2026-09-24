# API Contracts

## 1. Boundary

There are two APIs:

- Node.js exposes the public `/api/v1` contract to the web client.
- FastAPI exposes the private `/internal/v1` contract to Node.js and authorized workers.

The browser must never call FastAPI directly. Node.js owns authentication, authorization, public rate limits, idempotency and the final response shape.

## 2. Shared conventions

- Content type: `application/json; charset=utf-8`.
- IDs: UUID strings.
- Times: ISO 8601 UTC, for example `2026-09-24T10:30:00Z`.
- Public mutating requests accept `Idempotency-Key`.
- Node.js creates or forwards `X-Request-Id` and `traceparent`.
- Pagination uses opaque cursors, not page numbers.
- Unknown JSON fields are rejected for high-risk RAG/admin requests.

## 3. Public Node.js API

### Health

```http
GET /healthz
GET /readyz
```

`/healthz` reports process health. `/readyz` verifies required dependencies. Do not include secrets or internal hostnames in either response.

### Authentication and user profile

```http
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
PATCH /api/v1/me
```

### Sessions and messages

```http
POST /api/v1/sessions
GET  /api/v1/sessions?cursor={cursor}&limit=20
GET  /api/v1/sessions/{session_id}
PATCH /api/v1/sessions/{session_id}
DELETE /api/v1/sessions/{session_id}
GET  /api/v1/sessions/{session_id}/messages?cursor={cursor}&limit=50
```

All session operations enforce ownership in Node.js. Delete is a soft-delete request followed by the configured retention workflow.

### Chat

```http
POST /api/v1/chat
Authorization: Bearer <access-token>
Idempotency-Key: <client-generated-key>
```

Request:

```json
{
  "session_id": "01234567-89ab-cdef-0123-456789abcdef",
  "client_message_id": "web-01J8...",
  "message": "Can I patent this formulation?",
  "jurisdiction": "INDIA",
  "language": "en",
  "product_context": {
    "ingredients": ["neem", "tulsi"],
    "intended_use": "skin care"
  }
}
```

Successful response:

```json
{
  "request_id": "01234567-89ab-cdef-0123-456789abcdef",
  "message_id": "01234567-89ab-cdef-0123-456789abcdef",
  "answer_id": "01234567-89ab-cdef-0123-456789abcdef",
  "decision": "PASS",
  "answer": "Based on the retrieved source...",
  "confidence": 0.81,
  "citations": [
    {
      "id": "EV-01",
      "authority": "IP India",
      "document": "Patents Act, 1970",
      "locator": "Section 3(p)",
      "page_start": 12,
      "source_url": "https://example.gov.in/source"
    }
  ],
  "missing_information": [],
  "escalation_recommended": false,
  "disclaimer": "Information and guidance only; not legal advice."
}
```

Allowed decisions:

```text
PASS
PASS_WITH_CAUTION
ABSTAIN
ESCALATE
```

An `ABSTAIN` response is a successful, safe product outcome and may still use HTTP `200`. Infrastructure failures use `5xx` and must not be presented as abstention.

### Classification

```http
POST /api/v1/classifications
```

```json
{
  "description": "New herbal tablet prepared from...",
  "jurisdiction": "INDIA",
  "language": "en"
}
```

Response:

```json
{
  "category": "NEW_NON_CLASSICAL_DRUG",
  "confidence": 0.73,
  "signals": [],
  "legal_domains": ["AYUSH_DRUG", "PATENT"],
  "follow_up_questions": []
}
```

### Evidence and sources

```http
GET  /api/v1/sources
GET  /api/v1/sources/{source_id}
POST /api/v1/evidence/search
```

Evidence search request:

```json
{
  "query": "traditional knowledge patent exclusion",
  "jurisdiction": "INDIA",
  "legal_domains": ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  "limit": 10
}
```

### Registry lookup

```http
POST /api/v1/registry/patents/search
POST /api/v1/registry/trademarks/search
POST /api/v1/registry/designs/search
POST /api/v1/registry/gi/search
```

Every dynamic result includes `retrieved_at`, `adapter_name`, `source_url` and `availability_status`. Node.js applies stricter rate limits to these endpoints.

### Voice and language

```http
POST /api/v1/language/asr
POST /api/v1/language/translate
POST /api/v1/language/tts
```

Use multipart upload for audio. Enforce content type, duration and size limits before forwarding to FastAPI. Audio retention follows the consent and privacy policy.

### Escalation

```http
POST /api/v1/escalations
GET  /api/v1/escalations/{id}
```

Creation requires explicit consent when the case payload includes conversation or invention details.

### Admin ingestion

```http
POST /api/v1/admin/ingestion/jobs
GET  /api/v1/admin/ingestion/jobs/{job_id}
POST /api/v1/admin/corpora/{corpus_id}/activate
```

The create endpoint returns `202 Accepted`. Only an admin/service role can start ingestion; only an admin can activate a validated corpus.

## 4. Internal FastAPI contract

The internal API is reachable only on the backend network and requires a short-lived service token. Node.js passes user authorization context as constrained claims; FastAPI does not accept browser JWTs as service credentials.

### RAG query

```http
POST /internal/v1/rag/query
Authorization: Bearer <service-token>
X-Request-Id: <uuid>
```

```json
{
  "request_id": "01234567-89ab-cdef-0123-456789abcdef",
  "trace_id": "01234567-89ab-cdef-0123-456789abcdef",
  "session_id": "01234567-89ab-cdef-0123-456789abcdef",
  "message_id": "01234567-89ab-cdef-0123-456789abcdef",
  "query": "Can I patent this formulation?",
  "jurisdiction": "INDIA",
  "language": "en",
  "product_context": {}
}
```

Internal response:

```json
{
  "retrieval_run_id": "01234567-89ab-cdef-0123-456789abcdef",
  "corpus_version_id": "01234567-89ab-cdef-0123-456789abcdef",
  "decision": "PASS",
  "answer": "Based on the retrieved source...",
  "confidence": 0.81,
  "model": {
    "name": "local-model",
    "version": "v1"
  },
  "policy_version": "sha256:...",
  "claims": [],
  "citations": [],
  "missing_information": [],
  "timings_ms": {
    "classification": 25,
    "retrieval": 180,
    "reranking": 95,
    "generation": 2100,
    "verification": 330
  }
}
```

### Other internal endpoints

```http
POST /internal/v1/classify
POST /internal/v1/evidence/search
POST /internal/v1/registry/{registry}/search
POST /internal/v1/language/asr
POST /internal/v1/language/translate
POST /internal/v1/language/tts
POST /internal/v1/ingestion/jobs
GET  /internal/v1/ingestion/jobs/{job_id}
POST /internal/v1/corpora/{corpus_id}/activate
GET  /internal/v1/health
```

The internal models may evolve independently, but breaking changes require a new versioned path or a coordinated deployment with Node.js contract tests.

## 5. Error format

Use an RFC 9457 Problem Details-compatible body at both boundaries:

```json
{
  "type": "https://ipsakti.example/problems/retrieval-unavailable",
  "title": "Evidence service unavailable",
  "status": 503,
  "detail": "No answer was generated because authoritative evidence could not be retrieved.",
  "instance": "/api/v1/chat",
  "request_id": "01234567-89ab-cdef-0123-456789abcdef",
  "code": "RAG_RETRIEVAL_UNAVAILABLE"
}
```

Never return stack traces, SQL text, prompts, provider credentials, internal hostnames or raw model errors.

## 6. Status-code policy

| Status | Use |
|---:|---|
| `200` | successful read/chat, including evidence-based abstention |
| `201` | synchronously created resource |
| `202` | ingestion or another asynchronous job accepted |
| `400` | malformed request |
| `401` | missing or invalid authentication |
| `403` | authenticated but not authorized |
| `404` | resource absent or hidden by ownership policy |
| `409` | state/idempotency conflict |
| `422` | structurally valid JSON with invalid domain values |
| `429` | rate limit exceeded |
| `502` | invalid response from an upstream provider |
| `503` | required RAG/model/database service unavailable |
| `504` | service exceeded its time budget |

## 7. Contract testing

- Generate OpenAPI from Node.js and FastAPI in CI.
- Validate examples against their schemas.
- Run Node.js consumer tests against the FastAPI OpenAPI contract.
- Test idempotent chat retries and ingestion job creation.
- Test that the public ingress cannot reach `/internal/v1`.
- Test that `ABSTAIN` is distinct from timeout/provider failure.
- Preserve backward compatibility for the web app during the SIH demo branch.
