# IP-SAKTI Sahayak - Engineering Documentation

This folder contains the implementation blueprint for the IP-SAKTI Sahayak SIH project.

The agreed MVP stack is:

- React/Vite/Tailwind for the web client;
- Node.js for the public API, authentication, sessions, messages and normal application I/O;
- FastAPI for the internal AI/RAG service;
- PostgreSQL with `pgvector`, running in Docker, as the primary datastore;
- Docker Compose for local development and the SIH demo environment.

Start with:

1. `00-INDEX.md`
2. `01-PRODUCT-REQUIREMENTS.md`
3. `02-SYSTEM-ARCHITECTURE.md`
4. `05-DATA-SOURCES-AND-CORPUS.md`
5. `07-DATABASE-SCHEMA.md`
6. `08-RAG-AND-RETRIEVAL.md`
7. `19-IMPLEMENTATION-BACKLOG.md`

The blueprint combines the supplied SIH project plan/pitch with official-source research checked on **21 September 2026** and the team's Node.js/FastAPI service split.

The documentation is deliberately designed so the team can implement module-by-module without inventing the core product behavior, source model, data model, retrieval flow, safety policy, or deployment topology.
