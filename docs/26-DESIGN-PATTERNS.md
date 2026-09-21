# Design Patterns and Coding Conventions

## 1. Architectural style

Use a modular layered architecture with dependency inversion at provider boundaries.

```text
API
 ↓
Application services
 ↓
Domain logic
 ↓
Repository interfaces
 ↓
Infrastructure adapters
```

The domain must not import FastAPI, SQLAlchemy, requests, Bhashini SDKs, Neo4j clients, or model-serving clients directly.

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

FastAPI routes should orchestrate application services, not contain Bhashini/IP India/LLM details.

### Mutable corpus records

Never update legal text in place. Create versions.

## 11. Suggested Python package boundaries

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
