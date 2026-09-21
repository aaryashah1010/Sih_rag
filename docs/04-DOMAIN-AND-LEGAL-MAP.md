# Domain and Legal/Regulatory Map

> This is a software routing map, not legal advice. The system must retrieve and cite the underlying primary source before giving a user-facing conclusion.

## 1. Indian legal/regulatory domains

| Domain | Primary source family | Typical user question |
|---|---|---|
| Patent | Patents Act, 1970 + Patents Rules | Can the invention/formulation be patented? |
| Traditional knowledge | Patents Act exclusions + TKDL pointer | Is this already known traditional knowledge? |
| Trademark | Trade Marks Act, 1999 + Rules | Can I protect the brand/name/logo? |
| GI | GI Act, 1999 + Rules | Is the product associated with a geographical indication? |
| Design | Designs Act, 2000 + Rules | Can the visual/ornamental design be protected? |
| Biodiversity / ABS | Biological Diversity Act + Rules 2024 + ABS Regulations 2025 | Do biological resource/knowledge obligations apply? |
| Ayurveda drugs | Drugs and Cosmetics Act/Rules; Ministry of Ayush guidance | What drug classification/licensing framework is relevant? |
| Ayurveda Aahara | FSSAI Ayurveda Aahara Regulations 2022 + current orders/updates | Is this food under Ayurveda Aahara? |
| Cosmetics | Cosmetics Rules, 2020 | Does the product fall in cosmetics regulatory route? |
| Advertising | Drugs and Magic Remedies Act, 1954 and other applicable advertising rules | What promotional claims create risk? |
| Plant varieties | PPV&FR Act, 2001 | Is plant variety protection relevant? |
| Case law | Official court sources | What do courts say about a specific issue? |

## 2. Patent routing

The Patents Act page on IP India explicitly lists Section 3(p), excluding an invention that in effect is traditional knowledge or an aggregation/duplication of known properties of traditionally known components.

Implementation implication:

```text
If user asks patentability
  -> retrieve patent eligibility rules
  -> retrieve relevant prior-art/TK pointers
  -> distinguish:
       legal exclusion
       novelty/prior art
       inventive step
       disclosure requirements
       procedural considerations
```

The system should never collapse these into one "patentable/not patentable" boolean.

## 3. Trademark routing

Trademark queries should separate:

- registrability;
- classification of goods/services;
- conflicts/search;
- filing procedure;
- enforcement/renewal.

International trademark questions should route to the applicable national law plus, where relevant, WIPO Madrid resources. A WIPO system is not a replacement for domestic examination.

## 4. GI routing

GI should be modeled as a geographically anchored protection framework, not as a general brand-registration route.

Relevant entities:

```text
GI
Product
Geographical area
Applicant association
Goods category
Registration
```

## 5. Design routing

Design queries focus on visual/original ornamental features, not functional technical inventions. International questions can route to WIPO Hague resources subject to member-country conditions.

## 6. Biodiversity / ABS routing

The current source set must use the post-2024/post-2025 framework. The National Biodiversity Authority now lists the Biological Diversity Rules, 2024 and the Biological Diversity (Access to Biological Resources and Knowledge Associated thereto and Fair and Equitable Sharing of Benefits) Regulations, 2025.

Core software signals:

```text
uses_biological_resource
uses_associated_knowledge
source_country
source_state
access_purpose
research_or_commercial
transfer_or_exchange
user_nationality/entity_type
```

The ABS tool should output:

```json
{
  "status": "possible_obligation",
  "basis": ["source_id:..."],
  "next_step": "review_applicable_NBA_process",
  "confidence": 0.71
}
```

Not:

```json
{"status": "you definitely need approval"}
```

## 7. Ayurveda drug/product classification

The software should model classification as a regulatory routing problem.

Suggested internal enum:

```text
CLASSICAL_ASU_DRUG
PATENT_OR_PROPRIETARY_ASU_DRUG
NEW_NON_CLASSICAL_DRUG
PHYTOPHARMACEUTICAL
AYURVEDA_AAHARA
COSMETIC
NON_REGULATED_OR_UNKNOWN
```

The system must retain the distinction between software classification and legal determination:

> "System classification: Ayurveda Aahara candidate" is safer than "Your product legally is Ayurveda Aahara."

## 8. International layer

Core international corpus:

- TRIPS
- WIPO PCT
- WIPO Madrid System
- WIPO Hague System
- WIPO Budapest Treaty
- WIPO GRATK Treaty
- Convention on Biological Diversity
- Nagoya Protocol

For each international source, store:

```text
jurisdiction = INTERNATIONAL
instrument_type = TREATY | SYSTEM | GUIDANCE
status = IN_FORCE | NOT_IN_FORCE | HISTORICAL | GUIDANCE
```

The WIPO GRATK Treaty requires special care: it was adopted on 24 May 2024 and enters into force three months after 15 eligible parties deposit ratification/accession instruments. Current official notifications retrieved for the research snapshot show ratifications/accessions that do not by themselves establish that the treaty is already in force, so the application must track treaty status dynamically rather than hard-coding "in force". See the official WIPO treaty pages in `24-RESEARCH-REFERENCES.md`.

## 9. Rule-vs-LLM boundary

Rules decide:

- jurisdiction;
- required source filters;
- source access restrictions;
- safety gates;
- whether more information is mandatory;
- whether live lookup is needed.

LLMs assist with:

- query understanding;
- entity extraction;
- natural-language explanations;
- candidate legal-domain suggestions.

LLMs must not unilaterally override policy gates.
