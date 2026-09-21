# Product Requirements — IP-SAKTI Sahayak

## 1. Product statement

IP-SAKTI Sahayak is a source-cited AI guidance system for Ayurveda-related intellectual property and regulatory questions. A user describes a product, formulation, process, brand, biological resource, or export goal in natural language. The system determines the relevant context, retrieves authoritative evidence, explains the applicable route, cites the underlying source, and explicitly identifies uncertainty.

## 2. Target users

### Primary

- AYUSH startups and MSMEs
- Ayurveda practitioners
- Researchers and academic institutions
- Medicinal-plant cultivators and communities
- Product/innovation teams building Ayurveda-related goods

### Secondary

- Students and educators
- IP facilitators
- Compliance teams
- Human legal/IP experts receiving escalated cases

## 3. Core user jobs

1. "I have this Ayurveda product. What regulatory category might apply?"
2. "Can this formulation be protected by a patent?"
3. "Does traditional knowledge create a prior-art concern?"
4. "Do I need to consider biodiversity / ABS requirements?"
5. "How does trademark/GI/design protection relate to this product?"
6. "I want to sell/export this product. What international framework should I look at?"
7. "Show me the exact source for every important statement."
8. "I speak an Indian language and want to ask by voice."

## 4. Scope

### In scope

- Indian IP and regulatory guidance
- International treaty/framework guidance
- Product classification assistance
- Patent/TK prior-art pointers
- ABS/biodiversity routing
- Trademark, GI and design routing
- Ayurveda drug/cosmetic/food regulatory routing
- Source-cited RAG
- Live registry lookup adapters where technically/legal-accessible
- Multilingual text support
- Voice input/output
- Human escalation
- Auditability and evaluation

### Out of scope for MVP

- Filing a patent/trademark/GI application on the user's behalf
- Binding legal opinions
- Automated legal strategy that claims certainty
- Full access/copy of TKDL restricted data
- Automatic scraping of every government portal every day
- Unreviewed case-law summaries
- Medical diagnosis or treatment recommendations

## 5. Functional requirements

### FR-01 — Chat

Users can submit free-text questions with optional structured metadata.

Required request context:

```json
{
  "message": "I developed a new herbal formulation using neem and tulsi...",
  "jurisdiction": "india",
  "language": "en",
  "session_id": "optional",
  "product_context": {
    "category": "unknown",
    "contains_biological_resource": true
  }
}
```

### FR-02 — Jurisdiction selection

The UI must expose:

- India
- International

The backend must apply the selection as a hard retrieval filter unless the user explicitly requests a comparison.

### FR-03 — Product classification

The system must support at least:

- Classical/generic medicine
- Patent/proprietary medicine
- New/non-classical drug
- Phytopharmaceutical
- Nutraceutical / Ayurveda Aahara
- Cosmetic

The classifier must support `unknown` and `needs_more_information`.

### FR-04 — Legal-domain routing

The router may select one or more:

```text
PATENT
TRADEMARK
GI
DESIGN
TRADITIONAL_KNOWLEDGE
BIODIVERSITY_ABS
AYURVEDA_DRUG
FOOD_AYURVEDA_AAHARA
COSMETIC
ADVERTISING
INTERNATIONAL_PATENT
INTERNATIONAL_TRADEMARK
INTERNATIONAL_DESIGN
INTERNATIONAL_TK_GR
TREATY_GENERAL
CASE_LAW
```

### FR-05 — Retrieval

The retrieval service must combine:

- Exact/keyword search
- Vector similarity
- Metadata filtering
- Cross-encoder reranking

### FR-06 — Answer generation

The answer must contain:

1. direct response;
2. reasoning/explanation based on evidence;
3. applicable route or next step;
4. citations;
5. uncertainty/confidence;
6. permanent informational-guidance disclaimer;
7. escalation recommendation when appropriate.

### FR-07 — Citation verification

A generated claim must not be presented as supported unless its supporting evidence chunk is known and stored.

### FR-08 — Abstention

The system must abstain when:

- retrieval score is below threshold;
- required legal element is missing;
- evidence conflicts materially;
- source version is stale for a live-regulatory question;
- source is unauthorized/restricted;
- classification confidence is below minimum for a classification-dependent answer.

### FR-09 — Human escalation

The user can submit an escalation package:

```text
question
classification
jurisdiction
retrieved citations
why confidence is low
user-provided documents (optional)
contact information (only with consent)
```

### FR-10 — Multilingual

Phase 3 target:

```text
user language -> language detection -> ASR (optional)
-> translation to internal canonical language
-> Indian-law retrieval
-> grounded answer in canonical language
-> translation to user language
-> TTS (optional)
```

## 6. Non-functional requirements

| Requirement | Target |
|---|---|
| Traceability | Every answer stores query, retrieval set, model version and source version IDs |
| Reproducibility | Same corpus/model/config should reproduce approximately the same evidence set |
| Availability | MVP target >= 99% for application server during demo period |
| Latency | Text answer target <= 8 sec p95 excluding slow external registry calls |
| Registry timeout | Fail gracefully within 5 sec per adapter call |
| Privacy | Minimize personal data; avoid sending unpublished IP details to third-party LLM APIs |
| Security | JWT/OIDC-compatible auth, secret manager, TLS |
| Accessibility | Keyboard navigation, readable contrast, screen-reader labels |
| Explainability | Citation + source metadata visible on each answer |
| Audit | Structured event log for every completed request |

## 7. Acceptance criteria for MVP

A release is MVP-complete when:

- 30–50 curated benchmark questions exist.
- At least four Indian core legal domains work.
- Product classification supports all six target categories.
- Answers show precise source citations.
- Unsupported questions abstain instead of hallucinating.
- India/international source separation is enforced server-side.
- Ingestion can create a reproducible corpus version.
- The UI displays evidence and disclaimer.
- The API and DB are containerized.
- One deployable environment can be reproduced from the repository.
