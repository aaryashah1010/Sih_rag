# Architecture Decision Record

## ADR-001 — PostgreSQL + pgvector as primary retrieval store

### Context

The initial team plan allowed multiple vector databases. The pitch deck specified PostgreSQL + pgvector and hybrid retrieval.

### Decision

Use PostgreSQL + pgvector for MVP.

### Rationale

- one core database;
- metadata and vector storage together;
- easier transactional audit trail;
- fewer deployment components;
- sufficient for narrow Ayurveda IP corpus.

### Consequence

If scale exceeds PostgreSQL search requirements, add OpenSearch/another vector layer behind the repository interface.

## ADR-002 — Local open-source LLM

### Context

The pitch explicitly prefers a local open-source model so unpublished ideas do not leave the system.

### Decision

Use a locally hosted model behind an internal `LLMProvider` interface.

### Consequence

GPU/latency management becomes an operational responsibility.

## ADR-003 — Hybrid retrieval

### Decision

Combine keyword + vector + cross-encoder reranking.

### Rationale

Legal documents contain exact section identifiers and terminology that lexical search handles well, while user questions may be semantically phrased.

## ADR-004 — Strict India/international separation

### Decision

Jurisdiction is a server-side metadata filter, not only a UI toggle.

### Consequence

The system cannot accidentally mix sources merely because the LLM sees both.

## ADR-005 — Safe abstention

### Decision

Allow the system to refuse a confident answer when evidence is insufficient.

### Rationale

Wrongly confident legal/regulatory output is higher risk than an explicit evidence gap.

## ADR-006 — TKDL pointer-only

### Decision

Do not mirror restricted TKDL content without authorized access.

### Rationale

Official TKDL information states that full access is restricted under agreements.

## ADR-007 — Live registry as tools, not corpus

### Decision

Registry data is fetched through adapters and stored with timestamps, not treated as immutable legal text.

## ADR-008 — Optional knowledge graph

### Decision

No Neo4j dependency in Phase 1.

### Rationale

Base RAG can be proven first; graph is added when relationship reasoning has demonstrated value.

## ADR-009 - Node.js public API and FastAPI internal RAG service

### Context

The product needs ordinary web application operations as well as Python-heavy document and AI processing.

### Decision

Use Node.js as the only browser-facing API for authentication, users, sessions, messages and orchestration. Use FastAPI as a private service for ingestion, classification, retrieval, model calls and citation verification.

### Rationale

- keeps the public application workflow in the team's Node.js stack;
- preserves the Python ecosystem for RAG and document processing;
- prevents model/provider details from leaking into public routes;
- allows API and RAG workloads to scale independently.

### Consequence

The two services require a versioned internal contract, correlation IDs, service authentication and explicit timeout behavior.

## ADR-010 - One PostgreSQL instance with schema ownership

### Context

The MVP benefits from a small Docker footprint, but an unrestricted shared database would blur service ownership.

### Decision

Use one PostgreSQL + pgvector instance with `app`, `rag` and `audit` schemas. Node.js and FastAPI use separate least-privilege roles and separate migration histories.

### Consequence

The database can be split later, while the MVP retains simple backup and deployment. Cross-service data exchange still occurs through HTTP contracts, not by writing another service's tables.
