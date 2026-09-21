# Configuration Specification

## 1. Principle

Behavior that may change during evaluation should be configuration-driven.

## 2. Example config

```yaml
app:
  environment: development
  default_language: en
  default_jurisdiction: INDIA

retrieval:
  lexical_top_k: 50
  vector_top_k: 50
  rerank_top_k: 30
  context_top_k: 10
  min_rerank_score: 0.55

embeddings:
  model: <MODEL_NAME>
  dimension: 768

classification:
  high_confidence: 0.85
  medium_confidence: 0.65
  unknown_threshold: 0.45

generation:
  temperature: 0.1
  max_tokens: 1200

verification:
  min_support_score: 0.62
  require_citation_for_factual_claims: true
  fail_on_unsupported_material_claim: true

privacy:
  audio_retention_hours: 24
  conversation_retention_days: 180
  operational_log_text: false

language:
  provider: bhashini
  canonical_language: en
  enabled:
    - en
    - hi
    - gu

registry:
  timeout_seconds: 5
  max_calls_per_request: 3

ingestion:
  chunk_target_tokens: 600
  chunk_max_tokens: 1200
  ocr_enabled: true
  publish_only_validated_versions: true
```

## 3. Environment variables

```text
APP_ENV
DATABASE_URL
REDIS_URL
JWT_SECRET
OBJECT_STORAGE_URL
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
BHASHINI_INFERENCE_API_KEY
LLM_BASE_URL
LLM_MODEL
EMBEDDING_MODEL
RERANKER_MODEL
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
```

## 4. Versioning

Store a policy/config hash in every answer.

```text
policy_version = sha256(config + prompt-policy + source-policy)
```

This allows the team to reproduce historical system behavior.
