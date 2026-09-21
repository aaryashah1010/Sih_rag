# Implementation Backlog

## Phase 0 — Repository foundation

### P0.1

Create monorepo structure.

**DoD**
- web builds;
- API starts;
- Docker Compose starts.

### P0.2

Add PostgreSQL + pgvector migration.

**DoD**
- schema migration runs from empty DB;
- rollback strategy documented.

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
1. DB
2. ingestion
3. retrieval
4. grounded answer
5. verifier
6. API
7. UI
8. classifier
9. tools
10. multilingual
11. graph
12. production hardening
```

This order ensures a usable MVP exists early.
