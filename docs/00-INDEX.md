# IP-SAKTI Sahayak — Engineering Documentation Index

> **Project:** IP-SAKTI Sahayak  
> **Problem Statement:** Smart India Hackathon 2026 — PS 26045  
> **Team:** Kalakhata Kafka (Team 74)  
> **Document status:** Engineering blueprint / pre-implementation baseline  
> **Research snapshot:** 21 September 2026 (India time)

## 1. What this repository is for

This documentation turns the existing IP-SAKTI idea into an implementation-ready specification. The objective is that, after reviewing these files, the team should primarily be left with implementation, integration, testing, and deployment work rather than unresolved product or architecture questions.

The product is a multilingual, source-cited AI assistant for Ayurveda-related intellectual property and regulatory guidance. It is designed to separate Indian and international regimes, classify the user's product/use case, retrieve evidence from authoritative sources, generate a grounded explanation, verify citations, and abstain/escalate when evidence is insufficient.

The uploaded project plan defines the core concept as a chatbot that answers Ayurveda IP questions, shows the exact law/source behind an answer, separates Indian and international law, and supports regional language/voice interaction. The implementation baseline uses React/Vite/Tailwind, a Node.js public API, an internal FastAPI RAG service, PostgreSQL + pgvector, hybrid retrieval, a local cross-encoder, open-source LLMs, PyMuPDF/Tesseract, Bhashini/Indic models, Docker and JWT.

## 2. Documentation map

| File | Purpose |
|---|---|
| `00-INDEX.md` | Navigation and project conventions |
| `01-PRODUCT-REQUIREMENTS.md` | Product scope, requirements, personas, acceptance criteria |
| `02-SYSTEM-ARCHITECTURE.md` | End-to-end architecture and runtime/data flows |
| `03-USER-FLOWS.md` | Product/user journeys and state transitions |
| `04-DOMAIN-AND-LEGAL-MAP.md` | Legal/regulatory domain model and routing map |
| `05-DATA-SOURCES-AND-CORPUS.md` | Authoritative sources, what to ingest, what to reference only |
| `06-DATA-INGESTION-PIPELINE.md` | Download, parse, OCR, versioning, chunking, indexing |
| `07-DATABASE-SCHEMA.md` | PostgreSQL/pgvector schema and relationships |
| `08-RAG-AND-RETRIEVAL.md` | Hybrid retrieval, embeddings, reranking and context assembly |
| `09-CLASSIFICATION-ENGINE.md` | Product classification and deterministic decision layer |
| `10-AGENT-AND-TOOL-DESIGN.md` | Query router, ABS helper, registry lookup, escalation tools |
| `11-CITATION-SAFETY-AND-ABSTENTION.md` | Grounding, citation verification, confidence and safe fallback |
| `12-MULTILINGUAL-VOICE.md` | Language detection, Bhashini, ASR/TTS and translation loop |
| `13-KNOWLEDGE-GRAPH.md` | Knowledge graph model and graph-assisted reasoning |
| `14-API-CONTRACT.md` | REST API surface and request/response contracts |
| `15-UI-UX-SPEC.md` | Screens, components, states and accessibility |
| `16-AUTH-PRIVACY-SECURITY.md` | Auth, DPDP-aligned controls, threat model, secrets |
| `17-EVALUATION-TEST-PLAN.md` | RAG/classification/citation/product test strategy |
| `18-DEVOPS-DEPLOYMENT.md` | Docker, environment, CI/CD, deployment and observability |
| `19-IMPLEMENTATION-BACKLOG.md` | Ordered coding backlog with Definition of Done |
| `20-CONFIG-SPEC.md` | Config-driven behavior and environment variables |
| `21-LIVE-REGISTRY-ADAPTERS.md` | IP India/NBA/e-Courts live lookup strategy |
| `22-CASE-LAW-CORPUS.md` | Optional case-law ingestion and citation policy |
| `23-OPERATIONS-RUNBOOK.md` | Ingestion, rollback, incidents, monitoring and maintenance |
| `24-RESEARCH-REFERENCES.md` | Official sources and research notes |
| `25-DECISION-RECORD.md` | Architecture decisions and their consequences |
| `26-DESIGN-PATTERNS.md` | Node.js/Python coding boundaries and implementation patterns |
| `27-SEQUENCE-DIAGRAMS.md` | Runtime flows across web, Node.js, FastAPI and PostgreSQL |

## 3. Project rules

1. The LLM is never treated as the legal source of truth.
2. Every user-facing legal/regulatory claim must be traceable to retrieved evidence.
3. India and international regimes are separate retrieval domains.
4. A registry lookup is dynamic evidence, not a static corpus document.
5. TKDL full content is never mirrored without authorized access.
6. The system must be able to answer "insufficient evidence" instead of fabricating.
7. Legal/regulatory output is informational guidance, not legal advice.
8. Source documents are immutable by version; updates create new versions.
9. OCR text must carry an extraction-quality flag and never silently become "trusted text".
10. All model, source, retrieval and policy versions used for an answer are auditable.

## 4. Architecture baseline decision

The first architecture document suggested interchangeable vector stores such as ChromaDB, Weaviate or Pinecone. The SIH technical approach later narrowed this to PostgreSQL + pgvector with hybrid keyword + vector retrieval and a local cross-encoder. This blueprint standardizes on PostgreSQL + pgvector so structured metadata, vectors, audit records and application state stay in one operational datastore.

The public/backend boundary is also fixed:

- the browser communicates only with the Node.js API;
- Node.js handles ordinary input/output, authentication, authorization, user/session data and API orchestration;
- FastAPI is private to the Docker network and handles RAG, ingestion, model inference and evidence verification;
- Node.js calls FastAPI through a versioned internal HTTP contract;
- each service owns its PostgreSQL schema and migration history.

Neo4j remains an optional Phase 2/3 component for graph-heavy reasoning. The application must not depend on Neo4j for the Phase 1 MVP.

## 5. Definition of "implementation-ready"

The documentation is considered ready when the team can create the repository using the following top-level modules without inventing core behavior:

```text
apps/
  web/
  api-node/
services/
  rag-fastapi/
infra/
  docker/
  migrations/
  monitoring/
data/
  manifests/
  evaluation/
docs/
  (this documentation set)
```
