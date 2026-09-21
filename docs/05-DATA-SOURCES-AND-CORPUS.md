# Data Sources and Corpus Plan

## 1. Source hierarchy

Use the following evidence hierarchy:

### Tier A — Primary official law/regulation/treaty

Highest priority:

- India Code
- IP India official law/rules pages
- National Biodiversity Authority
- CDSCO
- Ministry of Ayush
- FSSAI
- WIPO
- WTO
- Convention on Biological Diversity

### Tier B — Official procedure/portal data

- IP India public search/e-services
- NBA ABS e-filing
- WIPO system services
- eCourts official services

### Tier C — Official explanatory/guidance material

Use only when useful and label it as guidance/explanatory material.

### Tier D — Secondary commentary

Do not use as primary legal truth for MVP.

## 2. Source registry

Create one row per source family.

```yaml
source_key:
name:
authority:
url:
jurisdiction:
domain:
source_type:
access_method:
update_frequency:
version_detection:
allowed_for_generation: true
restricted: false
notes:
```

## 3. India Code

**Portal:** https://www.indiacode.nic.in/indiacode/home.jsp

Use for central legislation and subordinate legislation. India Code describes itself as the repository for Indian legislations, and the revamped portal launched in August 2026 added improved search, semantic/speech features and navigation.

### Ingestion

Prefer:

1. official downloadable document where available;
2. official HTML/structured page;
3. manual manifest of source URLs;
4. scheduled re-fetch.

Store:

```text
act_id
act_number
act_year
short_title
enactment_date
enforcement_date
ministry
section_id
schedule_id
source_url
retrieved_at
```

## 4. IP India

**Portal:** https://ipindia.gov.in/

**E-services:** https://ipindia.gov.in/pages/e-services

**E-gateways:** https://ipindia.gov.in/pages/e-gateways

The official portal provides e-filing and public search links for patents, trademarks, designs and related workflows.

Use two pathways:

- static/legal corpus: Acts, Rules, manuals and official notices;
- dynamic lookup: public search/registry adapter.

Never mix dynamic registry results into the static legal corpus.

## 5. National Biodiversity Authority

**Main:** https://nbaindia.org/  
**Notifications/guidelines:** https://www.nbaindia.nic.in/public-information/notification-guidelines  
**ABS e-filing:** https://absefiling.nic.in/NBA/login/auth

The current source set includes the Biological Diversity Rules, 2024 and the 2025 ABS Regulations.

Treat ABS applications/records as dynamic and access-controlled.

## 6. Ministry of Ayush

**Portal:** https://www.ayush.gov.in/

Use for:

- official Ayush policy/guidance;
- ASU&H regulatory resources;
- annual reports / official notices;
- institutional information.

The system must not interpret promotional Ministry content as the legal instrument when a primary statute/rule exists.

## 7. CDSCO

**Traditional Drugs:** https://www.cdsco.gov.in/opencms/en/Traditional_Drugs/

Use for:

- Drugs and Cosmetics Act/Rules material;
- traditional drug definitions;
- manufacturing/licensing-related source material;
- relevant notifications.

## 8. FSSAI

**Food regulations:** https://fssai.gov.in/food-law/regulations

The current FSSAI portal lists the Food Safety and Standards (Ayurveda Aahara) Regulations, 2022 and later official orders/updates. The source index also showed a 25 July 2025 order and a 19 June 2026 Ayurveda Aahara recipe-related order.

Implementation rule:

> Never assume the 2022 Gazette is the latest operational state. Index amendments/orders separately and create a current-effective-version resolver.

## 9. TKDL

**Portal:** https://www.tkdl.res.in/

Full TKDL access is restricted to patent offices under access agreements. The TKDL itself states that it is not the prior art in itself; the underlying books are the source of prior-art information.

Therefore:

### Allowed without restricted access

- store public metadata about TKDL;
- explain what TKDL is;
- show an "authorized TKDL lookup recommended" pointer;
- use publicly available source books where copyright/access permits;
- track a user statement such as "matches likely traditional-knowledge pattern".

### Not allowed by default

- ingest restricted TKDL records;
- copy restricted formulations into the corpus;
- expose restricted database contents to users.

## 10. International sources

### WIPO PCT

https://www.wipo.int/en/web/pct-system

### Madrid

https://www.wipo.int/en/web/madrid-system/

### Hague

https://www.wipo.int/en/web/hague-system/

### Budapest Treaty

https://www.wipo.int/en/web/treaties/registration/budapest/index

### WIPO GRATK

https://www.wipo.int/en/web/treaties/ip/gratk/

### WTO TRIPS

https://www.wto.org/english/tratop_e/trips_e/trips_e.htm

### CBD / Nagoya

https://www.cbd.int/abs/text

## 11. Optional case-law sources

Start with official court services before secondary databases:

- eCourts: https://services.ecourts.gov.in/
- High Courts eCourts: https://hcservices.ecourts.gov.in/

Case-law ingestion should be a separate corpus partition.

## 12. Corpus manifests

Store manifests like:

```yaml
corpus_version: "india-core-2026-09-21"
documents:
  - source_key: india_code_patents_act
    url: "..."
    expected_jurisdiction: INDIA
    domain: PATENT
    refresh: monthly
    extraction: html_or_pdf

  - source_key: fssai_ayurveda_aahara
    url: "..."
    expected_jurisdiction: INDIA
    domain: FOOD_AYURVEDA_AAHARA
    refresh: weekly
    extraction: pdf
```

## 13. What becomes searchable

Searchable:

- statutes;
- rules;
- regulations;
- Gazette notifications;
- official guidance;
- official treaty text;
- official system procedures;
- selected official judgments/orders.

Dynamic-only:

- registry status;
- filing status;
- application status;
- current case status;
- current e-filing information.

Restricted/pointer-only:

- TKDL full records without authorized access.
