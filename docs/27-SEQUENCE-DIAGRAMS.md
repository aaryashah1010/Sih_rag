# Runtime Sequence Diagrams

## 1. Ordinary application request

```mermaid
sequenceDiagram
    participant U as User
    participant W as React Web
    participant N as Node.js API
    participant DB as PostgreSQL app schema

    U->>W: Open conversation history
    W->>N: GET /api/v1/sessions/{id}
    N->>N: Authenticate and authorize owner
    N->>DB: Read session and messages
    DB-->>N: Application records
    N-->>W: Public response
    W-->>U: Render conversation
```

FastAPI is not called for ordinary user, session, message or consent operations.

## 2. Standard India RAG chat

```mermaid
sequenceDiagram
    participant U as User
    participant W as React Web
    participant N as Node.js API
    participant ADB as PostgreSQL app schema
    participant F as FastAPI RAG
    participant RDB as PostgreSQL rag schema
    participant L as Local LLM

    U->>W: Submit question
    W->>N: POST /api/v1/chat + Idempotency-Key
    N->>N: Authenticate, validate, rate limit
    N->>ADB: Persist user message
    N->>F: POST /internal/v1/rag/query
    F->>F: Classify and build retrieval filters
    F->>RDB: Lexical + vector search
    RDB-->>F: Filtered candidates
    F->>F: Fuse, rerank and build context
    F->>L: Generate with evidence IDs
    L-->>F: Draft answer
    F->>F: Verify claims and citations
    F-->>N: Decision + answer + evidence
    N->>ADB: Persist answer, claims and citations
    N-->>W: Public answer response
    W-->>U: Render answer and evidence
```

## 3. Safe abstention

```mermaid
sequenceDiagram
    participant W as React Web
    participant N as Node.js API
    participant F as FastAPI RAG
    participant DB as PostgreSQL rag schema

    W->>N: POST /api/v1/chat
    N->>F: Internal RAG query
    F->>DB: Search active corpus with hard filters
    DB-->>F: No sufficient evidence
    F-->>N: decision=ABSTAIN + missing_information
    N-->>W: 200 with safe abstention response
```

Abstention is a valid RAG decision. It is not used to hide infrastructure errors.

## 4. FastAPI timeout or outage

```mermaid
sequenceDiagram
    participant W as React Web
    participant N as Node.js API
    participant F as FastAPI RAG

    W->>N: POST /api/v1/chat
    N->>F: Internal RAG query
    F--xN: Timeout/unavailable
    N->>N: Record failure with request_id
    N-->>W: 503/504 Problem Details
```

Node.js does not generate a fallback legal answer from memory. Ordinary Node.js routes remain available.

## 5. International query

```mermaid
sequenceDiagram
    participant N as Node.js API
    participant F as FastAPI RAG
    participant DB as PostgreSQL+pgvector
    participant L as Local LLM

    N->>F: Query with jurisdiction=INTERNATIONAL
    F->>DB: Search active WIPO/WTO/CBD sources only
    DB-->>F: Jurisdiction-filtered evidence
    F->>L: Grounded generation
    L-->>F: Draft with citation IDs
    F->>F: Verify jurisdiction and support
    F-->>N: Cited decision
```

## 6. Live registry lookup

```mermaid
sequenceDiagram
    participant U as User
    participant N as Node.js API
    participant F as FastAPI RAG
    participant R as Registry Adapter
    participant P as Official Portal

    U->>N: Ask current status of application X
    N->>F: Authenticated internal request
    F->>R: lookup(application X)
    R->>P: Permitted public/authorized request
    P-->>R: Registry data
    R-->>F: Result + retrieved_at + source_url
    F-->>N: Dynamic result
    N-->>U: Result with timestamp and source
```

## 7. Voice query

```mermaid
sequenceDiagram
    participant U as User
    participant W as React Web
    participant N as Node.js API
    participant F as FastAPI RAG
    participant B as Language Adapter

    U->>W: Record speech
    W->>N: Upload audio with consent
    N->>N: Validate type, size and duration
    N->>F: Internal ASR request
    F->>B: Speech to source-language text
    B-->>F: Transcript
    F->>B: Translate to canonical language
    B-->>F: Canonical query
    F->>F: RAG + verification
    F->>B: Translate answer preserving citations
    B-->>F: Localized answer
    F-->>N: Text answer + optional audio reference
    N-->>W: Public response
    W-->>U: Localized text and speech
```

## 8. Corpus ingestion

```mermaid
sequenceDiagram
    participant A as Admin
    participant N as Node.js API
    participant F as FastAPI/Worker
    participant S as Official Source
    participant O as Object Storage
    participant DB as PostgreSQL rag schema

    A->>N: POST /api/v1/admin/ingestion/jobs
    N->>N: Authorize admin and idempotency key
    N->>F: Create internal ingestion job
    F-->>N: job_id + QUEUED
    N-->>A: 202 Accepted
    F->>S: Fetch allowlisted document
    S-->>F: Source bytes
    F->>F: Checksum, parse/OCR, chunk, embed
    F->>O: Store immutable artifacts
    F->>DB: Store candidate corpus records
    F->>F: Run corpus validation
    F->>DB: Mark READY or FAILED
```

Corpus activation is a separate admin action after validation.

## 9. Escalation

```mermaid
sequenceDiagram
    participant U as User
    participant W as React Web
    participant N as Node.js API
    participant DB as PostgreSQL app schema
    participant H as Human Expert

    N-->>W: Answer recommends escalation
    W-->>U: Explain evidence gap and request consent
    U->>W: Consent and submit
    W->>N: POST /api/v1/escalations
    N->>DB: Verify consent and create case
    N-->>H: Assigned case notification
    H->>N: Status/update
    N->>DB: Persist update
    N-->>W: Case status
```
