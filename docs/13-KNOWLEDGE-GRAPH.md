# Knowledge Graph Design

## 1. Purpose

The knowledge graph is optional for MVP retrieval. Its purpose is to represent relationships that are awkward to express through flat vectors.

Example:

```text
Ayurveda formulation
  -> uses -> biological resource
  -> may involve -> associated traditional knowledge
  -> may trigger -> biodiversity/ABS review

Product
  -> marketed as -> Ayurveda Aahara
  -> governed by -> FSSAI regulation

Brand
  -> protected by -> trademark system
  -> classified using -> Nice Classification
```

## 2. Nodes

```text
Act
Rule
Regulation
Treaty
Authority
Jurisdiction
Product
ProductCategory
Ingredient
BiologicalResource
TraditionalKnowledgeConcept
IPRight
LegalDomain
Case
RegistryRecord
Organization
GeographicalArea
```

## 3. Relationships

```text
ACT_CONTAINS_SECTION
RULE_IMPLEMENTS_ACT
REGULATION_ISSUED_BY
AUTHORITY_ADMINISTERS
SOURCE_APPLIES_TO
PRODUCT_HAS_CATEGORY
PRODUCT_USES_RESOURCE
PRODUCT_ASSOCIATED_WITH_TK
IP_RIGHT_COVERS
TREATY_RELATES_TO
CASE_INTERPRETS
REGISTRY_RECORD_FOR
```

## 4. Example graph

```text
[Product]
  ├─HAS_CATEGORY─>[Ayurveda Aahara]
  │                    └─GOVERNED_BY─>[FSS Regulations]
  │
  ├─USES_RESOURCE─>[Neem]
  │                    └─BIO_RESOURCE─>[true]
  │
  └─HAS_BRAND─>[Brand X]
                       └─POTENTIAL_RIGHT─>[Trademark]
```

## 5. Why graph + RAG

RAG answers:

> "What does the law say?"

Graph helps:

> "Which concepts and regulatory domains are connected to this product?"

Use graph to guide retrieval, not to replace primary evidence.

## 6. Neo4j boundary

Phase 1:

- no hard dependency.

Phase 2:

- graph index generated from curated metadata.

Phase 3:

- graph-enhanced retrieval and explanation.

## 7. Graph provenance

Every node and edge derived from legal text must carry:

```text
source_id
document_version_id
chunk_id
extracted_at
extraction_method
confidence
```

Never create a legal edge without provenance.
