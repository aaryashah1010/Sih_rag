# Live Registry Adapter Design

## 1. Why registry data is separate

Registry information changes frequently and is not equivalent to a statute.

Examples:

- application status;
- publication status;
- registration number;
- current proprietor/owner information;
- pending/registered/expired state.

Therefore, registry results are time-stamped facts retrieved from a source.

## 2. Adapter interface

```python
class RegistryAdapter(Protocol):
    name: str

    def search(self, query: RegistryQuery) -> RegistryResponse:
        ...
```

## 3. Response

```json
{
  "adapter": "ipindia_patent_public_search",
  "status": "SUCCESS",
  "retrieved_at": "2026-09-21T18:00:00Z",
  "source_url": "...",
  "records": [
    {
      "application_number": "...",
      "title": "...",
      "status": "...",
      "filing_date": "..."
    }
  ]
}
```

## 4. Failure modes

```text
SUCCESS
NO_RESULTS
SOURCE_UNAVAILABLE
RATE_LIMITED
CAPTCHA_REQUIRED
PARSER_CHANGED
UNAUTHORIZED
TIMEOUT
```

Never convert `SOURCE_UNAVAILABLE` into `NO_RESULTS`.

## 5. IP India

The official IP India e-services page exposes public-search capabilities for patents, trademarks and designs.

Implementation strategy:

1. manual prototype first;
2. adapter with browser-compatible request abstraction if permitted;
3. respect CAPTCHA/rate limits/terms;
4. add parser contract tests using saved fixtures;
5. detect portal layout changes.

Do not bypass access controls.

## 6. NBA / ABS

The official ABS e-filing service is login-protected. The application should treat it as:

```text
public guidance -> ingest
live applicant-specific records -> authorized integration only
```

For the hackathon, implement a safe "open official portal" pathway if authenticated API integration is not available.

## 7. eCourts

The eCourts interface supports searching cases by fields such as party name, case number and act/section, but access may use CAPTCHA and other anti-automation mechanisms.

Use:

- official search links;
- manual deep link;
- optional authorized adapter.

Do not automate around CAPTCHA.

## 8. Caching

Cache only when:

- source allows it;
- result has TTL;
- timestamp is shown.

Example:

```yaml
registry_cache:
  patent_status: 6h
  trademark_status: 6h
  case_status: 1h
```

These TTLs are starting points.
