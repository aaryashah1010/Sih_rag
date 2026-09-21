# REST API Contract

Base path:

```text
/api/v1
```

## 1. Health

```http
GET /health
GET /ready
```

## 2. Chat

```http
POST /chat
```

Request:

```json
{
  "session_id": "uuid",
  "message": "Can I patent this formulation?",
  "jurisdiction": "INDIA",
  "language": "en",
  "product_context": {}
}
```

Response:

```json
{
  "answer_id": "uuid",
  "decision": "PASS",
  "answer": "Based on the retrieved source...",
  "confidence": 0.81,
  "citations": [
    {
      "id": "EV-01",
      "authority": "IP India",
      "document": "Patents Act, 1970",
      "locator": "Section 3(p)",
      "page": 12
    }
  ],
  "missing_information": [],
  "escalation_recommended": false,
  "disclaimer": "Information and guidance only..."
}
```

## 3. Classification

```http
POST /classify
```

```json
{
  "description": "New herbal tablet prepared from..."
}
```

Response:

```json
{
  "category": "NEW_NON_CLASSICAL_DRUG",
  "confidence": 0.73,
  "signals": [],
  "follow_up_questions": []
}
```

## 4. Sources

```http
GET /sources
GET /sources/{source_id}
```

## 5. Evidence

```http
POST /evidence/search
```

```json
{
  "query": "traditional knowledge patent exclusion",
  "jurisdiction": "INDIA",
  "legal_domains": ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  "top_k": 10
}
```

Response:

```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "score": 0.91,
      "authority": "IP India",
      "document": "Patents Act, 1970",
      "section": "3(p)",
      "text": "..."
    }
  ]
}
```

## 6. Registry

```http
POST /registry/patents/search
POST /registry/trademarks/search
POST /registry/designs/search
POST /registry/gi/search
```

All dynamic results include:

```text
retrieved_at
adapter_name
source_url
availability_status
```

## 7. Escalation

```http
POST /escalations
GET /escalations/{id}
```

## 8. Voice

```http
POST /language/asr
POST /language/translate
POST /language/tts
```

## 9. Admin ingestion

Protect with an admin/service role:

```http
POST /admin/ingestion/run
GET  /admin/ingestion/runs
POST /admin/corpus/activate
```

No regular user should be able to activate a corpus.

## 10. Error format

Use RFC 7807-compatible structure:

```json
{
  "type": "https://example.org/problems/retrieval-unavailable",
  "title": "Evidence service unavailable",
  "status": 503,
  "detail": "No answer was generated because authoritative evidence could not be retrieved.",
  "trace_id": "..."
}
```

Never return raw provider credentials or internal stack traces.
