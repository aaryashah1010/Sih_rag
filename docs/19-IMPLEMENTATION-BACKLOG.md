# Implementation Backlog

## Phase 0 — Repository foundation

### P0.1

Create monorepo structure.

**DoD**
- web builds;
- Node.js public API starts;
- FastAPI RAG service starts;
- Docker Compose starts.

### P0.2

Add PostgreSQL + pgvector migration.

**DoD**
- schema migration runs from empty DB;
- `app`, `rag` and `audit` schemas are created;
- Node.js and FastAPI runtime roles cannot write each other's schema;
- rollback strategy documented.

### P0.3 Public Node.js foundation

Implement:

- request IDs and structured logging;
- JWT authentication middleware;
- session/message repositories;
- RFC Problem Details errors;
- FastAPI internal client with timeout and service authentication.

**DoD**
- ordinary session/message CRUD works without FastAPI;
- duplicate `Idempotency-Key` values do not duplicate a chat message;
- FastAPI outage does not break ordinary profile/session routes.

### P0.4 FastAPI RAG foundation

Implement:

- `/internal/v1/health`;
- `/internal/v1/rag/query` request/response models;
- service-token validation;
- PostgreSQL repositories for the `rag` schema;
- correlation ID propagation.

**DoD**
- browser/public token cannot call the internal API;
- OpenAPI contract passes Node.js consumer tests.

## Phase 1 — Corpus and MVP RAG

### P1.1 Source manifest

Implement source registry for:

- India Code
- IP India
- NBA
- CDSCO
- Ministry Ayush
- FSSAI

### P1.2 Fetcher

Implement HTTP fetching with:

- timeout;
- retry;
- checksum;
- content-type validation.

### P1.3 PDF/HTML parser

Implement:

- PyMuPDF;
- HTML parser;
- OCR fallback.

### P1.4 Section/chunk parser

DoD:

- preserves section labels;
- preserves page numbers;
- produces chunk metadata.

### P1.5 Embeddings

DoD:

- configured model;
- dimension validation;
- batch generation.

### P1.6 Hybrid search

DoD:

- lexical + vector;
- score merge;
- metadata filters.

### P1.7 Cross-encoder

DoD:

- local reranker endpoint;
- top-N ranking;
- latency measured.

### P1.8 Grounded generation

DoD:

- prompt with evidence only;
- answer includes citation IDs.

### P1.9 Citation verifier

DoD:

- unsupported claims detected;
- answer blocked/modified on failure.

### P1.10 Chat UI

DoD:

- India/international toggle;
- evidence drawer;
- disclaimer;
- confidence.

### P1.11 End-to-end orchestration

DoD:

- web calls Node.js only;
- Node.js persists the user message before invoking FastAPI;
- FastAPI returns a structured RAG result;
- Node.js persists and returns the answer/citations;
- timeout, abstention and infrastructure failure are visibly distinct.

## Phase 2 — Classification and regulated routing

### P2.1 Classification rules

Six product categories.

### P2.2 Follow-up question engine

Minimum-question logic.

### P2.3 Query router

Typed tool plan.

### P2.4 ABS helper

Current 2024/2025 source set.

### P2.5 TKDL pointer

Restricted access safe behavior.

## Phase 3 — Live tools

### P3.1 Patent registry adapter

Official public-search interface, with rate limiting and failure handling.

### P3.2 Trademark adapter

Same pattern.

### P3.3 Design/GI adapter

Same pattern.

### P3.4 eABS adapter

Do not automate protected flows beyond authorized/public interfaces.

### P3.5 Optional eCourts adapter

Official case search only.

## Phase 4 — International corpus

Add:

- TRIPS
- PCT
- Madrid
- Hague
- Budapest
- GRATK
- CBD
- Nagoya

Add treaty status/version metadata.

## Phase 5 — Multilingual/voice

### P5.1 Language detection

### P5.2 BHASHINI translation

### P5.3 ASR

### P5.4 TTS

### P5.5 Legal glossary

## Phase 6 — KG and advanced reasoning

### P6.1 Neo4j schema

### P6.2 Entity extraction

### P6.3 Graph-assisted retrieval

## Phase 7 — Production hardening

- DPDP-aligned privacy implementation
- retention/deletion
- audit console
- monitoring
- evaluation dashboards
- human expert workflow

## Coding order

```text
1. Docker/PostgreSQL platform
2. Node.js and FastAPI service skeletons
3. schema migrations and service roles
4. ingestion
5. retrieval
6. grounded answer and verifier
7. Node.js/FastAPI contract integration
8. UI
9. classifier and tools
10. multilingual
11. graph
12. production hardening
```

This order ensures a usable MVP exists early.
