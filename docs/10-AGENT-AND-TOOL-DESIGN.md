# Agent and Tool Design

## 1. Philosophy

Do not build a free-form autonomous agent.

Use a controlled orchestrator with explicit tools and typed outputs.

```text
Query
  -> Router
      -> search_corpus()
      -> lookup_registry()
      -> check_abs()
      -> tkdl_pointer()
      -> search_case_law()
      -> escalate()
```

Each tool has a bounded purpose.

## 2. Query Router

Input:

```json
{
  "query": "...",
  "jurisdiction": "INDIA",
  "classification": "...",
  "domains": []
}
```

Output:

```json
{
  "steps": [
    {"tool": "search_corpus", "domain": "PATENT"},
    {"tool": "search_corpus", "domain": "TRADITIONAL_KNOWLEDGE"},
    {"tool": "check_abs", "when": "biological_resource_signal"}
  ]
}
```

## 3. Corpus Search Tool

```python
search_corpus(
    query: str,
    jurisdiction: str,
    legal_domains: list[str],
    effective_date: date | None = None,
    top_k: int = 10
) -> SearchResult
```

Returns only evidence references, not natural-language answers.

## 4. ABS Helper

Purpose:

- detect whether biological-resource/associated-knowledge signals justify ABS research;
- retrieve relevant NBA rules/regulations;
- identify official e-filing path;
- produce a checklist of missing facts.

Must not make an unqualified legal determination.

## 5. TKDL Pointer Tool

Purpose:

- flag possible traditional-knowledge overlap;
- explain that full TKDL content is access restricted;
- recommend authorized review where needed.

Never return restricted TKDL content.

## 6. Live Registry Tool

Purpose:

- query current status from official registry/public-search mechanisms;
- attach retrieval timestamp;
- return raw structured registry facts;
- distinguish "no result" from "registry unavailable".

## 7. Case-Law Search Tool

Optional Phase 2.

Input:

```text
legal issue
jurisdiction
date range
```

Output:

```text
case name
court
date
citation/reference
official URL
relevant passage
```

The system should prefer official court copies.

## 8. Escalation Tool

```python
create_escalation(
    answer_id,
    reason,
    missing_information,
    user_consent
)
```

## 9. Orchestrator state

Use a typed state object:

```python
class QueryState(TypedDict):
    user_query: str
    language: str
    jurisdiction: str
    normalized_query: str
    classification: dict
    routes: list[dict]
    evidence: list[dict]
    registry_results: list[dict]
    draft_answer: str
    claims: list[dict]
    verification: dict
    decision: str
```

## 10. Agent safety

Never allow tools to:

- execute arbitrary code;
- modify legislation corpus directly;
- publish a new corpus version;
- expose restricted documents;
- send external messages without user consent;
- submit official applications.
