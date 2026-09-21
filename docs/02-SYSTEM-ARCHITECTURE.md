# System Architecture — IP-SAKTI Sahayak

## 1. Architectural goals

The architecture is designed around one principle:

> **The language model explains evidence; it does not become the legal database.**

The system therefore separates:

- user interaction;
- language processing;
- deterministic policy/classification;
- retrieval;
- optional agent/tool orchestration;
- generation;
- citation verification;
- confidence/abstention;
- audit.

## 2. Logical architecture

```text
                         ┌────────────────────────────┐
                         │         React Web App       │
                         │ Chat / Classification /     │
                         │ Evidence / Voice / Escalate│
                         └─────────────┬──────────────┘
                                       │ HTTPS
                         ┌─────────────▼──────────────┐
                         │        FastAPI Gateway      │
                         │ Auth • Rate Limit • Session │
                         └─────────────┬──────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │         Query Understanding           │
                    │ language • intent • entities •      │
                    │ jurisdiction • product signals       │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │  Deterministic Policy + Classifier    │
                    │ product class • legal domains •       │
                    │ required follow-up questions          │
                    └──────────────────┬───────────────────┘
                                       │
              ┌────────────────────────▼────────────────────────┐
              │                Agent / Tool Router              │
              │ RAG Search | ABS Helper | TK Pointer |         │
              │ Registry Adapter | Human Escalation            │
              └───────────────┬───────────────────────┬─────────┘
                              │                       │
                 ┌────────────▼────────────┐   ┌────▼────────────┐
                 │   Retrieval Service      │   │ External Tools │
                 │ keyword + vector +       │   │ IP India       │
                 │ filters + reranker       │   │ NBA/eABS       │
                 └────────────┬────────────┘   │ eCourts (opt.) │
                              │                 └────┬────────────┘
                              │                      │
                 ┌────────────▼──────────────────────▼────────────┐
                 │            Evidence Context Builder             │
                 │ source version • section • paragraph • score   │
                 └────────────────────────┬───────────────────────┘
                                          │
                              ┌───────────▼───────────┐
                              │  Local Open-Source LLM │
                              │  grounded generation  │
                              └───────────┬───────────┘
                                          │
                       ┌──────────────────▼───────────────────┐
                       │ Citation Verifier + Confidence       │
                       │ claim extraction • support checks    │
                       │ contradiction / threshold / abstain  │
                       └──────────────────┬───────────────────┘
                                          │
                         ┌────────────────▼────────────────┐
                         │ Answer Formatter / Localization │
                         └────────────────┬────────────────┘
                                          │
                         ┌────────────────▼────────────────┐
                         │ UI: Answer + Citations +        │
                         │ Confidence + Disclaimer + CTA   │
                         └─────────────────────────────────┘

Shared infrastructure:
  PostgreSQL + pgvector
  Object storage
  Optional Neo4j
  Redis (rate limits/cache/task queue if needed)
  Structured logs / metrics
```

## 3. Deployment topology

### MVP

Single Linux server:

```text
Nginx
  ├── web container
  └── API container
       ├── PostgreSQL/pgvector
       ├── optional Redis
       └── local model runtime
```

For a demo, the model may be served by a local inference engine. The architecture should keep an abstraction around model serving so the LLM can later move to a dedicated GPU host.

### Scaled deployment

```text
CDN
  -> Nginx / ingress
  -> web
  -> API replicas
      -> retrieval workers
      -> ingestion workers
      -> model serving
      -> PostgreSQL primary/read replicas
      -> object storage
      -> Redis
      -> Neo4j (optional)
```

## 4. Request lifecycle

### Step 1 — Receive

FastAPI validates:

- auth;
- language;
- jurisdiction;
- message size;
- optional product context.

### Step 2 — Normalize

- Unicode normalization.
- Script detection.
- spelling variants.
- transliteration preservation.
- PII redaction for logs where applicable.

### Step 3 — Understand

Generate a structured query object:

```json
{
  "intent": "patentability",
  "jurisdiction": "INDIA",
  "product_category": "PATENT_PROPRIETARY_MEDICINE",
  "legal_domains": ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  "entities": {
    "ingredients": ["neem", "tulsi"]
  },
  "needs_live_registry": false
}
```

### Step 4 — Retrieve

Apply hard metadata filters before semantic search.

Example:

```sql
WHERE jurisdiction IN ('INDIA', 'BOTH')
  AND source_status = 'ACTIVE'
  AND legal_domain IN ('PATENT', 'TRADITIONAL_KNOWLEDGE')
```

### Step 5 — Rerank

The top ~30–50 raw candidates are reranked and the best ~6–12 evidence units are placed into the generation context.

### Step 6 — Generate

The model receives only:

- system policy;
- user question;
- classification context;
- retrieved evidence;
- citation IDs.

### Step 7 — Verify

The verifier checks that:

- each factual claim references a citation ID;
- citation IDs exist;
- referenced chunks contain supporting text;
- the source jurisdiction is permitted;
- no restricted source content is reproduced.

### Step 8 — Decide

```text
PASS
PASS_WITH_LOW_CONFIDENCE
ABSTAIN
ESCALATE
```

### Step 9 — Localize

Translate/format answer for the user's requested language, preserving legal names, section numbers and citations exactly.

### Step 10 — Audit

Store an immutable answer record with:

- prompt hash;
- normalized query;
- corpus version;
- source version IDs;
- retrieval scores;
- model version;
- policy version;
- verifier result;
- final decision.

## 5. Module boundaries

Use interfaces, not cross-module database spaghetti.

```text
api/
  routes/
  dependencies/

domain/
  query/
  classification/
  legal/
  answer/

services/
  retrieval/
  generation/
  verification/
  localization/
  escalation/

adapters/
  sources/
  registries/
  language/

repositories/
  users/
  documents/
  chunks/
  conversations/
  audits/

workers/
  ingestion/
  indexing/
  evaluation/
```

## 6. Failure isolation

An external source must never be able to take down the core chat service.

Examples:

- IP India unavailable -> registry result marked unavailable; corpus RAG still works.
- Bhashini unavailable -> text input/output still works in supported fallback language.
- Neo4j unavailable -> graph-assisted reasoning disabled; base RAG remains usable.
- embedding service unavailable -> request can retry; do not generate from memory.
- LLM unavailable -> return service error/queue, not fabricated content.
