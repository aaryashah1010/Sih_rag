# Data Ingestion Pipeline

## 1. Goal

Turn authoritative documents into versioned, section-aware, citation-safe evidence.

## 2. Pipeline

```text
Source manifest
   ↓
Fetcher
   ↓
Raw artifact store
   ↓
Checksum / version detector
   ↓
Parser
   ├─ HTML parser
   ├─ PDF text extractor
   └─ OCR fallback
   ↓
Structural parser
   ↓
Legal section segmentation
   ↓
Normalization
   ↓
Chunk builder
   ↓
Embedding generator
   ↓
Keyword index
   ↓
PostgreSQL + pgvector
   ↓
Corpus version
```

## 3. Fetching

Every fetch creates:

```text
fetch_id
source_id
requested_url
retrieved_at
http_status
content_type
bytes
sha256
etag (if available)
last_modified (if available)
```

Do not overwrite raw files.

## 4. Parsing rules

### HTML

Preserve:

- heading hierarchy;
- section identifiers;
- tables;
- links;
- publication/update date where available.

### PDF

Use:

- PyMuPDF first;
- OCR fallback for scanned pages;
- Tesseract for MVP OCR.

Store:

```text
extraction_method = TEXT | OCR
ocr_confidence = nullable
page_number
```

## 5. Structural chunking

Do not chunk purely by character count.

Preferred hierarchy:

```text
Act
  Chapter
    Section
      sub-section
        clause
```

For regulations:

```text
Regulation
  rule
    sub-rule
      clause
```

Chunk metadata:

```json
{
  "document_version_id": "...",
  "section_label": "Section 3",
  "heading": "What are not inventions",
  "page_start": 12,
  "page_end": 12,
  "jurisdiction": "INDIA",
  "legal_domain": "PATENT",
  "language": "en"
}
```

## 6. Chunk size

Use semantic boundaries first. As a starting point:

- target 300–800 tokens;
- hard upper bound around 1,200 tokens;
- preserve full sentences;
- use overlap only when needed.

Do not split a statute clause across chunks when it would destroy meaning.

## 7. Metadata filters

Every chunk must support:

```text
jurisdiction
country
authority
legal_domain
instrument_type
instrument_name
section_label
effective_from
effective_to
document_version
language
status
```

## 8. Versioning

Version key:

```text
sha256 + source URL + source retrieval timestamp
```

A content-identical refetch must not create a new document version.

A changed source must create a new version.

## 9. Effective-date handling

A source can be:

- published;
- effective;
- superseded;
- repealed;
- withdrawn;
- historical.

The retrieval layer should normally exclude sources that are not effective for the requested date unless the user asks a historical question.

## 10. OCR quality gate

When OCR is used:

```text
ocr_confidence >= threshold
  -> index
else
  -> index with low_quality=true
  -> never treat low-quality chunk as sole evidence for a high-risk answer
```

## 11. Deduplication

Use:

- SHA-256 exact duplicate;
- normalized title + issue date;
- optional fuzzy duplicate check.

Keep superseded and current versions separate.

## 12. Ingestion run record

```json
{
  "run_id": "uuid",
  "source_key": "fssai_ayurveda_aahara",
  "started_at": "...",
  "finished_at": "...",
  "downloaded": 10,
  "changed": 2,
  "unchanged": 8,
  "failed": 0,
  "indexed_chunks": 410,
  "warnings": []
}
```

## 13. Re-ingestion safety

Never publish partially indexed data as a new active corpus.

Use:

```text
BUILDING
VALIDATING
READY
ACTIVE
RETIRED
FAILED
```

Only a `READY` corpus version can become `ACTIVE`.
