# Repository Guidance

## Read before coding

Before making code changes, read:

- `docs/02-SYSTEM-ARCHITECTURE.md`
- `docs/14-API-CONTRACT.md`
- `docs/16-AUTH-PRIVACY-SECURITY.md`
- `docs/26-DESIGN-PATTERNS.md`
- `docs/28-BUILD-STATUS.md`

Treat the contracts and architecture docs as the baseline. Preserve existing API contracts unless the task explicitly requires a change.

## Architecture and service boundaries

Follow the ports/adapters architecture and keep responsibilities in the appropriate layer:

- `domain`: business concepts and rules, independent of frameworks and providers
- `ports`: interfaces at persistence and provider boundaries
- `application`: use cases and orchestration
- `infrastructure`: database and external-service adapters
- `api`: routes, controllers, middleware, request validation, and response presentation

Node owns the public API and Node application data. Node must never write the `rag` schema. FastAPI must never write the Node application schema. Keep database access behind the owning service's repositories and use the service contract across the boundary.

## Ownership

This repository work is split between two owners.

### My ownership

I own:

- Public Node API
- Authentication and authorization additions
- Roles
- Escalations
- Consent
- Admin endpoints
- Classification
- Registry adapters
- ABS/TKDL pointers
- Multilingual and voice integration
- Rate limiting
- Redis
- Retention
- Audit
- CI
- Contract tests

### Teammate ownership

My teammate owns:

- `/internal/v1/rag/query`
- Retrieval
- Generation
- Verifier
- Reranker
- RAG-specific implementation

Do not modify `services/rag-fastapi` RAG, retrieval, or generation implementation files. Coordinate any required service-contract changes with the teammate. New Python modules for classification and registry adapters are permitted when needed, provided they do not alter the teammate-owned implementation.

## Security, errors, and response behavior

- Return errors using RFC 9457 Problem Details.
- Never log user message bodies, conversation contents, invention details, or sensitive payloads. Log safe metadata and correlation identifiers instead.
- `ABSTAIN` is a successful product result and uses HTTP 200.
- Map infrastructure failures to HTTP 503 or 504 as appropriate. Never represent an infrastructure failure as an abstention.
- Keep authentication and authorization at the Node public boundary. Internal service authentication must remain distinct from browser authentication.

## Tests and completion

- Write tests against fakes first, following the existing `apps/api-node/src/test/fakes.ts` pattern.
- Before considering a Node change complete, run `npm run typecheck` and `npm test` from `apps/api-node/`.
- Keep pull requests small and focused. Do not refactor unrelated code.
- Update `docs/28-BUILD-STATUS.md` when a step is completed.
