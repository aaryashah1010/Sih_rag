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
