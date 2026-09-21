# Evaluation and Test Plan

## 1. Evaluation dimensions

The system must be evaluated separately on:

1. classification;
2. retrieval;
3. citation correctness;
4. answer grounding;
5. jurisdiction separation;
6. abstention safety;
7. multilingual quality;
8. registry correctness;
9. latency;
10. reliability.

## 2. Benchmark dataset

Start with 50 manually authored cases.

Suggested distribution:

```text
10 patent/TK
8 trademark
5 GI
5 design
8 biodiversity/ABS
8 Ayurveda drug/food/cosmetic
6 international
```

Add adversarial cases.

## 3. Golden labels

Each benchmark question should specify:

```yaml
id:
question:
jurisdiction:
expected_classification:
required_domains:
gold_sources:
gold_sections:
must_abstain: false
requires_registry: false
notes:
```

## 4. Retrieval metrics

### Recall@K

```text
Recall@K =
relevant gold evidence retrieved in top K
-----------------------------------------
all relevant gold evidence
```

### MRR

Measures rank quality of the first relevant result.

### nDCG

Useful when multiple evidence chunks have graded relevance.

## 5. Citation metrics

### Citation support rate

```text
supported_material_claims
-------------------------
all_material_claims
```

Target for a demo should be close to 100% for claims selected as "supported". Do not make a broad accuracy claim from a small benchmark.

### Citation precision

How many presented citations actually support the corresponding claim.

## 6. Jurisdiction leakage test

Create questions where India and international sources contain similar concepts.

Fail example:

> User selected India; answer cites only TRIPS without clearly explaining domestic application.

System should either retrieve Indian sources or explicitly explain the international framework as a separate requested comparison.

## 7. Abstention tests

Include:

- obscure questions;
- intentionally unsupported claims;
- conflicting versions;
- low-quality OCR;
- unavailable live registry.

Expected behavior:

```text
not enough evidence
+
reason
+
next action
```

## 8. Classification tests

Measure:

- accuracy;
- macro F1;
- confusion matrix;
- abstention/unknown rate.

The unknown category is important.

## 9. Multilingual tests

For each supported language:

- ASR transcription quality;
- translation adequacy;
- preservation of legal identifiers;
- answer fidelity after back-translation;
- TTS intelligibility.

Do not measure only BLEU. Human expert review is required for high-risk legal terminology.

## 10. Retrieval regression suite

Any corpus update should run:

```text
same questions
same query
old retrieval
new retrieval
compare
```

Flag:

- previously supported answer now unsupported;
- current law replaced by historical source;
- jurisdiction leakage;
- citation locator changes.

## 11. Load tests

Test:

- 10 concurrent users;
- 25 concurrent users;
- ingestion during chat;
- registry adapter timeout;
- model restart;
- DB restart.

## 12. Security tests

- JWT tampering;
- broken authorization;
- SQL injection;
- XSS in rendered legal text;
- prompt injection;
- malicious PDF;
- oversized upload;
- path traversal in document storage.

## 13. Release gate

A build cannot be promoted if:

- citation support regression is material;
- current-source resolver selects a superseded document;
- jurisdiction leakage occurs;
- restricted source content is exposed;
- abstention tests produce confident unsupported legal claims.
