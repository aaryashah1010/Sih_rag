# Authentication, Privacy and Security

## 1. Authentication

MVP options:

- JWT with short-lived access tokens;
- refresh token rotation;
- optional Google/Firebase Auth adapter.

Recommended application roles:

```text
USER
EXPERT
ADMIN
INGESTION_SERVICE
EVALUATION
```

## 2. Authorization

```text
USER
  -> own sessions
  -> own escalations

EXPERT
  -> assigned escalations

ADMIN
  -> source/corpus administration
  -> audit views

INGESTION_SERVICE
  -> source fetch/index only
```

## 3. Privacy principle

The product may receive unpublished inventions or business information. Therefore:

- minimize collection;
- avoid unnecessary third-party LLM calls;
- do not put full raw user documents into analytics logs;
- separate identifiers from conversation content where practical;
- implement deletion/retention policies.

## 4. DPDP-aligned design

India's Digital Personal Data Protection Rules, 2025 are now part of the current legal environment and the Government published an enforcement timeline in November 2025.

The application should therefore design for:

- clear purpose notice;
- consent where required for optional processing;
- access/correction/deletion workflows as applicable;
- data retention limits;
- breach/incident processes;
- processor/third-party inventory;
- auditable consent records.

The exact legal applicability and implementation obligations should be reviewed by counsel before production.

## 5. Sensitive IP information

Unpublished IP is not automatically "personal data"; it may still be confidential business information.

Treat user-submitted invention details as confidential application data.

Log:

```text
question_hash
session_id
request_type
latency
decision
```

Prefer not to log full question text in operational logs.

## 6. Secrets

Never commit:

- API keys;
- database passwords;
- JWT secrets;
- model credentials;
- BHASHINI keys.

Environment variables:

```text
DATABASE_URL
JWT_SECRET
BHASHINI_INFERENCE_API_KEY
MODEL_ENDPOINT
OBJECT_STORAGE_URL
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
REDIS_URL
```

## 7. Threat model

### Prompt injection

Mitigation:

- retrieval documents are data;
- tool permissions are explicit;
- system policy is outside retrieved context.

### Data exfiltration

Mitigation:

- no raw document echo;
- source authorization checks;
- redaction;
- rate limits.

### Registry abuse

Mitigation:

- throttling;
- caching;
- adapter-specific limits;
- do not bypass CAPTCHA/access controls.

### Corpus poisoning

Mitigation:

- allowlist sources;
- signed/hashed manifests;
- admin-only corpus activation;
- source diff review.

### Hallucination

Mitigation:

- retrieval-only generation;
- citation verification;
- abstention.

## 8. Audit

Record:

```text
login
logout
consent
query
classification
retrieval
registry lookup
generation
verification
answer
escalation
admin corpus activation
data deletion
```
