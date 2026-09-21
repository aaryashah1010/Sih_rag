# Case-Law Corpus

## 1. Purpose

Case law can improve explanations of how legal provisions have been interpreted, but it should not be the first source for straightforward statutory text.

## 2. Source policy

Preferred:

- Supreme Court official materials;
- High Court official/eCourts services;
- official judgments/orders.

Use secondary legal databases only as discovery aids unless licensing permits corpus ingestion.

## 3. Case record

```yaml
case_id:
court:
case_name:
decision_date:
case_number:
citation:
official_url:
source_document_hash:
legal_domains:
statutes_cited:
summary_status:
```

## 4. Extraction

Capture:

- court;
- decision date;
- facts summary;
- issue;
- holding;
- statutory provisions;
- final order.

Do not automatically convert the entire judgment into a simplistic rule.

## 5. Citation format

User-facing:

```text
Case: <name>
Court: <court>
Decision date: <date>
Official source: <URL>
```

## 6. AI policy

The model may summarize a case only from retrieved judgment text.

It must distinguish:

```text
holding
observation
argument by party
procedural history
```

## 7. Currentness

Case-law is time sensitive.

Every case record gets:

```text
retrieved_at
judgment_version_hash
```

If a later decision materially modifies/overrules the cited principle and the system does not know this, the answer should be conservative.
