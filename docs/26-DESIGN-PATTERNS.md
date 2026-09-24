# Design Patterns and Coding Conventions

## 1. Architectural style

Use a modular layered architecture with dependency inversion at provider boundaries.

```text
Public web API (Node.js)
  -> application/domain services
  -> app repositories and FastAPI client

Internal RAG API (FastAPI)
  -> RAG application/domain services
  -> rag repositories and provider adapters
```

The Node.js domain must not import web-framework or FastAPI-client details. The Python domain must not import FastAPI, SQLAlchemy, HTTP clients, Bhashini SDKs, Neo4j clients or model-serving clients directly.

## 2. Repository pattern

Use repositories for persistence.

```python
class ChunkRepository(Protocol):
    async def hybrid_search(self, query: SearchQuery) -> list[Evidence]: ...
```

Infrastructure:

```python
class PostgresChunkRepository(ChunkRepository):
    ...
```

This makes retrieval tests independent of a live DB.

## 3. Adapter pattern

Required for:

- BHASHINI;
- LLM provider;
- embedding provider;
- reranker;
- IP India registry;
- NBA/eABS;
- eCourts;
- object storage.

Example:

```python
class LLMProvider(Protocol):
    async def generate(self, request: GenerationRequest) -> GenerationResult: ...
```

## 4. Strategy pattern

Use for:

- source fetchers;
- document parsers;
- chunkers;
- jurisdiction policies;
- classification strategies.

```text
Parser
 ├─ HtmlParser
 ├─ PdfTextParser
 └─ OcrPdfParser
```

## 5. Chain of Responsibility

Use for request gates:

```text
Auth
 ↓
RateLimit
 ↓
InputValidation
 ↓
JurisdictionPolicy
 ↓
ClassificationPolicy
 ↓
Retrieval
 ↓
Generation
 ↓
Verification
```

Each stage can stop the request safely.

## 6. State machine pattern

Use for corpus lifecycle:

```text
BUILDING
  ↓
VALIDATING
  ├──> FAILED
  ↓
READY
  ↓
ACTIVE
  ↓
RETIRED
```

Use for answer lifecycle:

```text
RECEIVED
  ↓
UNDERSTOOD
  ↓
CLASSIFIED
  ↓
RETRIEVED
  ↓
GENERATED
  ↓
VERIFIED
  ├──> ABSTAINED
  ├──> ESCALATED
  └──> DELIVERED
```

## 7. Unit of Work

Use around ingestion/database updates when a single document version needs multiple writes.

The publication transaction must be atomic.

## 8. Specification pattern

Represent reusable filters:

```python
JurisdictionSpec
EffectiveDateSpec
LegalDomainSpec
SourceAuthoritySpec
```

Compose them before retrieval.

## 9. Policy object

Keep high-risk policies in explicit classes:

```python
class CitationPolicy:
    require_source = True
    require_claim_support = True
```

## 10. Anti-patterns to avoid

### God Agent

Do not create one agent that can do everything.

### LLM-as-router-without-guardrails

Do not let the LLM choose forbidden sources.

### Direct SQL everywhere

Use repositories.

### Provider logic in routes

Node.js routes should validate public requests and invoke application services, not contain SQL or RAG logic. FastAPI routes should invoke RAG application services, not contain Bhashini/IP India/LLM details.

### Browser-to-FastAPI calls

The web app must use the Node.js public API. FastAPI is an internal service and must not become a second public backend.

### Shared-database ownership leaks

Node.js writes only the `app` schema and FastAPI writes only the `rag` schema. Sharing a PostgreSQL instance is not permission to bypass the service contract.

### Mutable corpus records

Never update legal text in place. Create versions.

## 11. Suggested Node.js package boundaries

```text
src/
|-- domain/
|   |-- users/
|   |-- sessions/
|   `-- escalations/
|-- application/
|   |-- chat/
|   |-- messages/
|   `-- consent/
|-- ports/
|   |-- rag-client.ts
|   `-- repositories.ts
|-- infrastructure/
|   |-- postgres/
|   |-- auth/
|   `-- rag-http/
`-- api/
    |-- routes/
    |-- middleware/
    `-- errors/
```

## 12. Suggested Python package boundaries

```text
src/
├── domain/
│   ├── legal/
│   ├── classification/
│   ├── evidence/
│   └── answers/
├── application/
│   ├── chat/
│   ├── ingestion/
│   └── escalation/
├── ports/
│   ├── llm.py
│   ├── language.py
│   ├── registry.py
│   └── storage.py
├── infrastructure/
│   ├── postgres/
│   ├── bhashini/
│   ├── llm/
│   ├── registry/
│   └── object_storage/
└── api/
```
