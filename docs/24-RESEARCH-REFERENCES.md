# Research References and Verification Notes

> Research snapshot: **21 September 2026**. URLs should be rechecked before production because public portals and legal instruments can change.

## 1. Project-provided source documents

### Team plan

`Ayurveda IPR Assistant — Architecture, Tech Stack & Phase-wise Plan — Team Reference (SIH 2026)`

Key source-derived points:

- source-cited Ayurveda IP chatbot;
- India/international separation;
- multilingual/voice;
- six product categories;
- agent routing;
- vector retrieval + knowledge graph;
- official data corpus;
- phased implementation.

### SIH pitch deck

`74_Kalakhata-Kafka_SIH26045.pptx`

Key source-derived points:

- Problem Statement 26045;
- IP-SAKTI Sahayak;
- React/Vite/Tailwind;
- FastAPI;
- PostgreSQL + pgvector;
- hybrid vector + keyword retrieval;
- local cross-encoder reranker;
- PyMuPDF + Tesseract;
- Bhashini/Indic models;
- open-source LLM;
- Docker/JWT;
- citation verification and safe abstention.

## 2. India Code

Official portal:

https://www.indiacode.nic.in/indiacode/home.jsp

India Code is an official government repository for Indian legislation. The revamped India Code portal was launched on 13 August 2026 and introduced improvements including semantic/speech search and navigation.

Useful entry:

https://www.indiacode.nic.in/

## 3. Patent law / IP India

Patents Act / Section 3:

https://ipindia.gov.in/acts/patent-act-1970/section-3

The page includes Section 3(p), concerning inventions that in effect are traditional knowledge or an aggregation/duplication of known properties of traditionally known components.

Patents Rules:

https://ipindia.gov.in/pages/patents/rules

IP India notes an e-version of the Patents Rules and points users to Gazette notifications for amendments.

E-services:

https://ipindia.gov.in/pages/e-services

E-gateways:

https://ipindia.gov.in/pages/e-gateways

These pages expose official filing/public-search pathways.

## 4. Other Indian IP laws

Trade Marks Act, 1999:

https://www.indiacode.nic.in/indiacode/handle/123456789/1993

GI Act, 1999:

https://www.indiacode.nic.in/indiacode/handle/123456789/1981

Designs Act, 2000:

https://www.indiacode.nic.in/indiacode/handle/123456789/1917

PPV&FR Act, 2001:

https://www.indiacode.nic.in/indiacode/handle/123456789/1909

Drugs and Cosmetics Act, 1940:

https://www.indiacode.nic.in/indiacode/handle/123456789/2409

Drugs and Magic Remedies Act, 1954:

https://www.indiacode.nic.in/indiacode/bitstream/123456789/1412/1/195421.pdf

## 5. Ayurveda drug regulation

CDSCO Traditional Drugs:

https://www.cdsco.gov.in/opencms/en/Traditional_Drugs/

The official CDSCO page explains the statutory framework for Ayurvedic/Siddha/Unani drugs and references Part XVI–XVIII of the Drugs and Cosmetics Rules, 1945.

Ministry of Ayush resources:

https://www.ayush.gov.in/

A Ministry of Ayush annual-report source also describes State/UT licensing authorities and Rule 158-B requirements for ASU medicines.

## 6. FSSAI Ayurveda Aahara

FSSAI regulations:

https://fssai.gov.in/food-law/regulations

Official Ayurveda Aahara Gazette:

https://fssai.gov.in/upload/notifications/2022/05/62789a20b54bdGazette_Notification_Ayurveda_Aahara_09_05_2022.pdf

The Gazette defines Ayurveda Aahara and excludes Ayurvedic drugs/proprietary medicines and certain other categories from that definition.

Current FSSAI advisory/orders page:

https://fssai.gov.in/food-law/advisories

As checked on 21 September 2026, this portal listed the 25 July 2025 Ayurveda Aahara order and a 19 June 2026 Ayurveda Aahara recipe-related order. This is why the corpus must track later orders/amendments separately from the 2022 Gazette.

## 7. Biodiversity / ABS

National Biodiversity Authority:

https://nbaindia.org/

Notifications and guidelines:

https://www.nbaindia.nic.in/public-information/notification-guidelines

ABS e-filing:

https://absefiling.nic.in/NBA/login/auth

The NBA source set currently includes:

- Biological Diversity Rules, 2024;
- Biological Diversity (Access to Biological Resources and Knowledge Associated thereto and Fair and Equitable Sharing of Benefits) Regulations, 2025.

India Code record:

https://www.indiacode.nic.in/indiacode/handle/123456789/2046

The ABS e-filing site notes that the Biological Diversity (Amendment) Act, 2023 came into force from 1 April 2024, and the 2024 Rules came into force on 21 December 2024.

## 8. TKDL

https://www.tkdl.res.in/

TKDL's official FAQ/about pages explain that the database is designed as a tool for patent examiners to understand codified Indian traditional medicine knowledge and that full database access is restricted under access agreements.

Important architecture conclusion:

**Use a pointer-only model unless the team has authorized access.**

## 9. WIPO PCT

https://www.wipo.int/en/web/pct-system

https://www.wipo.int/en/web/pct-system/introduction

WIPO describes PCT as a system allowing innovators to seek patent protection in multiple countries through a single international application procedure.

## 10. WIPO Madrid

https://www.wipo.int/en/web/madrid-system/

## 11. WIPO Hague

https://www.wipo.int/en/web/hague-system/

Current WIPO Hague materials include legal texts and guides. WIPO notes that the Hague System provides an international registration route for designs subject to its member-country framework.

## 12. Budapest Treaty

https://www.wipo.int/en/web/treaties/registration/budapest/index

The treaty concerns international recognition of microorganism deposits for patent procedure purposes.

## 13. WIPO GRATK Treaty

Treaty page:

https://www.wipo.int/en/web/treaties/ip/gratk/

Treaty text:

https://wipolex-res.wipo.int/edocs/lexdocs/treaties/en/gratk/trt_gratk_001en.pdf

WIPO says the treaty was adopted on 24 May 2024 and will enter into force three months after 15 eligible parties deposit ratification/accession instruments.

The WIPO resource centre and 2026 notifications retrieved during this research should be used to determine the live status at runtime. Do not hard-code treaty "in force" status.

## 14. WTO TRIPS

https://www.wto.org/english/docs_e/legal_e/27-trips_01_e.htm

The WTO publishes the official TRIPS text and related legal/interpretive materials.

## 15. Nagoya Protocol

https://www.cbd.int/abs/text

The CBD website provides the full text of the Nagoya Protocol, including provisions on access to genetic resources and associated traditional knowledge.

## 16. BHASHINI

Developer guide:

https://bhashini-developer-portal-dev.bhashini.co.in/docs/developer-guide

Quickstart:

https://bhashini-developer-portal-dev.bhashini.co.in/docs/get-started/quick-start

Model/service directory:

https://bhashini-developer-portal-dev.bhashini.co.in/docs/models/service-directory

Current developer documentation supports:

- ASR;
- translation;
- TTS;
- language detection;
- transliteration;
- combined pipelines.

The documented compute API uses an inference API key and task-specific service IDs. Keep this behind an adapter.

## 17. eCourts

https://services.ecourts.gov.in/

https://hcservices.ecourts.gov.in/hcservices/

The official interface supports case/act/section search flows. CAPTCHA and interface changes make a manual or authorized adapter safer than brittle automation.

## 18. Privacy / DPDP

MeitY:

https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit

As of the research snapshot, the Ministry site lists the Digital Personal Data Protection Rules, 2025, associated enforcement material, and Data Protection Board information. Production compliance should be reviewed against the latest official rules, notifications and implementation timeline.

## 19. Research limitations

This repository is an engineering specification, not a legal opinion.

Before production:

- verify every operative legal instrument against the latest official publication;
- verify amendment/supersession/effective dates;
- review portal terms and automation permissions;
- review DPDP applicability and retention;
- have an IP/regulatory professional validate the classification and high-risk answer policies.
