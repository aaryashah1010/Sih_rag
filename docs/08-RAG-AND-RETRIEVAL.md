# RAG and Retrieval Design

## 1. Retrieval objective

The system is not optimizing for "most similar text". It is optimizing for:

> **the smallest high-quality set of authoritative, jurisdiction-correct evidence that can support the requested answer.**

## 2. Query object

```json
{
  "raw_query": "...",
  "canonical_query": "...",
  "jurisdiction": "INDIA",
  "language": "hi",
  "legal_domains": ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  "product_category": "PATENT_PROPRIETARY_MEDICINE",
  "time_context": "current",
  "needs_registry": false
}
```

## 3. Retrieval stages

```text
query
 ↓
metadata filter
 ↓
lexical retrieval
 ↓
vector retrieval
 ↓
merge
 ↓
deduplicate
 ↓
cross-encoder rerank
 ↓
quality/jurisdiction gating
 ↓
context selection
```

## 4. Lexical retrieval

Use PostgreSQL FTS for exact legal terms:

- section numbers;
- act names;
- regulation numbers;
- defined terms;
- product names;
- abbreviations.

Example:

```sql
SELECT id, ts_rank(search_vector, websearch_to_tsquery('simple', :q)) AS score
FROM chunks
WHERE jurisdiction = :jurisdiction
ORDER BY score DESC
LIMIT 50;
```

## 5. Vector retrieval

Embed the canonical query.

Example conceptual query:

```sql
SELECT
    c.id,
    1 - (e.embedding <=> :query_vector) AS vector_score
FROM chunk_embeddings e
JOIN chunks c ON c.id = e.chunk_id
WHERE c.metadata->>'jurisdiction' = :jurisdiction
ORDER BY e.embedding <=> :query_vector
LIMIT 50;
```

## 6. Hybrid fusion

Use weighted reciprocal rank or normalized-score fusion.

Example:

```text
hybrid_score =
  0.45 * normalized_vector_score +
  0.35 * normalized_lexical_score +
  0.20 * domain_boost
```

The weights are configuration, not hard-coded forever.

## 7. Reranking

Use a local cross-encoder on the merged candidate set.

Input:

```text
[query, chunk_text]
```

Output:

```text
relevance_score
```

Keep:

- top 8–12 for answer context;
- top 20–30 in trace logs for evaluation.

## 8. Domain boosts

Boost matching exact metadata:

```text
+0.15 same legal domain
+0.10 same jurisdiction
+0.10 exact section term
+0.05 current effective version
-0.25 restricted source
-0.20 superseded document
-0.15 low-quality OCR
```

Do not allow boosting to rescue a fundamentally irrelevant chunk.

## 9. Context builder

The context should include:

```text
SOURCE_ID
AUTHORITY
DOCUMENT_TITLE
VERSION_DATE
SECTION/RULE/ARTICLE
PAGE
TEXT
```

Example:

```text
[EV-01]
Authority: Intellectual Property India
Instrument: Patents Act, 1970
Section: 3(p)
Version: <date>
Text: ...

[EV-02]
Authority: TKDL
Access: pointer-only
Status: restricted
Pointer: "Possible traditional-knowledge prior-art check recommended."
```

## 10. Context budget

Prefer 6–12 diverse chunks over 30 repetitive chunks.

Diversity rule:

- max 3 chunks per document section family unless needed;
- include definitions before operative clauses when necessary;
- include exception/exemption clauses if they affect the conclusion.

## 11. Retrieval guardrails

Before generation:

```text
if jurisdiction mismatch -> drop
if inactive source -> drop
if restricted text -> drop
if confidence under floor -> candidate only, not final evidence
if OCR low quality and no second source -> mark weak
```

## 12. No-answer threshold

Set thresholds in config:

```yaml
retrieval:
  lexical_top_k: 50
  vector_top_k: 50
  final_top_k: 10
  min_rerank_score: 0.55
  min_support_score: 0.62
```

These are initial values and must be benchmarked.

## 13. Query rewriting

Allow an internal query rewrite step, but never replace the original user question.

Store both:

```text
original_query
rewritten_query
```

A rewrite can expand:

```text
"Can I patent this?"

→
"Indian patent eligibility and exclusion of traditional knowledge for an Ayurveda formulation"
```

## 14. Retrieval test set

Maintain benchmark labels:

```yaml
question:
required_jurisdiction: INDIA
required_domains:
  - PATENT
gold_sections:
  - "Patents Act section 3(p)"
gold_documents:
  - "Patents Act, 1970"
```

Metrics:

- Recall@5
- Recall@10
- MRR
- nDCG
- citation support rate
- source correctness
- jurisdiction leakage rate
