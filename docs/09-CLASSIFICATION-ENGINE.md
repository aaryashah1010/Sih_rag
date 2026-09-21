# Product Classification Engine

## 1. Purpose

Classification is a routing aid. It should narrow the relevant regulatory/IP pathways without pretending to be a final legal determination.

## 2. Output contract

```json
{
  "category": "PATENT_PROPRIETARY_MEDICINE",
  "confidence": 0.82,
  "signals": [
    "medicine",
    "non-classical formulation",
    "commercial product"
  ],
  "unknowns": [
    "authoritative-classical-source status"
  ],
  "follow_up_questions": [
    "Is the formulation described in an authoritative classical Ayurveda book?"
  ]
}
```

## 3. Two-stage classifier

### Stage A — Deterministic rules

High-precision signals:

```text
contains cosmetic claims
contains food/nutrition positioning
explicitly says medicine/drug
explicitly cites classical text
explicitly says new formulation
contains plant/biological resource
```

### Stage B — LLM classification

The model interprets natural language and assigns candidate categories.

The model output must be schema-constrained JSON.

### Stage C — Rule reconciliation

Rules can:

- confirm;
- downgrade;
- mark unknown;
- require follow-up.

The model cannot override a hard rule.

## 4. Six core categories

```text
1. CLASSICAL_GENERIC_MEDICINE
2. PATENT_PROPRIETARY_MEDICINE
3. NEW_NON_CLASSICAL_DRUG
4. PHYTOPHARMACEUTICAL
5. AYURVEDA_AAHARA
6. COSMETIC
```

## 5. Classification questions

### Q1

What is the product primarily marketed/used as?

### Q2

Is the formula/process drawn from an authoritative classical Ayurveda source?

### Q3

Is it a new formulation/process or a known preparation?

### Q4

Does it contain/obtain/use biological resources or associated traditional knowledge?

### Q5

Is the user asking about IP, regulatory approval, manufacture/sale, export, or multiple topics?

## 6. Confidence bands

```text
>= 0.85: high confidence
0.65–0.8499: moderate confidence
0.45–0.6499: low confidence
< 0.45: unknown / ask more
```

These thresholds are starting points only and must be validated on labeled examples.

## 7. Important distinction

Do not expose:

> "AI classified your product as legally XYZ."

Prefer:

> "Based on the information provided, the product appears to fit the XYZ guidance pathway. This classification is a routing aid; the applicable authority may determine the final regulatory category."

## 8. Route examples

### Example A

User:

> "My company developed a new herbal tablet not described in classical texts."

Likely routing:

```text
NEW_NON_CLASSICAL_DRUG or PATENT_PROPRIETARY_MEDICINE
+
PATENT
+
TRADITIONAL_KNOWLEDGE
+
POSSIBLE_BIODIVERSITY_ABS
```

Ask a targeted question before claiming a final route.

### Example B

User:

> "I sell an Ayurveda nutrition product based on recipes listed in Ayurveda literature."

Likely routing:

```text
AYURVEDA_AAHARA
+
FSSAI
+
TRADEMARK
```

### Example C

User:

> "I want to protect the brand name for my Ayurveda skincare line."

Likely:

```text
COSMETIC
+
TRADEMARK
+
COSMETICS_RULES
```

## 9. Product classification is not medical diagnosis

The classifier must never output diagnosis or treatment recommendations.
