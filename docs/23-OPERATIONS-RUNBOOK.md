# Operations Runbook

## 1. Daily health checklist

```text
API health
DB connectivity
vector index health
model health
registry adapters
language provider
disk/object storage
error rate
```

## 2. Ingestion run

```text
1. Trigger source fetch
2. Verify HTTP/content type
3. Hash artifact
4. Compare with previous version
5. Parse
6. OCR if required
7. Validate sections
8. Build chunks
9. Generate embeddings
10. Run corpus regression tests
11. Mark READY
12. Activate
```

## 3. Corpus rollback

If a new corpus causes regressions:

```text
1. deactivate current corpus
2. reactivate previous validated corpus
3. record incident
4. identify source/version causing regression
5. fix parser/metadata
6. rerun evaluation
```

Never delete the bad version; mark it FAILED/RETIRED.

## 4. Model rollback

Store model version in every answer.

Rollback:

```text
model_registry
  current -> previous
```

Then rerun the benchmark.

## 5. High hallucination incident

Symptoms:

- citation failures;
- unsupported section numbers;
- fabricated case names.

Actions:

1. disable confident generation;
2. raise retrieval threshold;
3. enable strict abstention;
4. inspect retrieval results;
5. run benchmark;
6. restore normal mode only after pass.

## 6. Registry portal changed

Symptoms:

```text
parser_changed
empty_results
unexpected_html
```

Actions:

1. stop trusting parsed registry results;
2. return source-unavailable;
3. alert maintainer;
4. capture fixture;
5. update parser;
6. add regression test.

## 7. Source changed unexpectedly

If hash changes unexpectedly:

```text
download raw
diff metadata/title/date
do not activate
manual review if legal instrument identity is ambiguous
```

## 8. Security incident

Immediately:

- revoke affected credentials;
- disable compromised integration;
- preserve audit logs;
- rotate secrets;
- inspect access logs;
- document incident timeline.

## 9. Data deletion

Process:

```text
identify user
→ validate authorization
→ delete/soft-delete according to policy
→ remove derived indexes where required
→ record audit event
```

## 10. Backup restore drill

At least once before real deployment:

```text
restore DB backup
restore object storage
activate corpus
run smoke tests
run benchmark
```
