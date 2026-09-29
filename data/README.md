# Corpus data

- `manifests/` contains the reviewed allowlist of official sources.
- `raw/` contains checksum-addressed source downloads and is intentionally git-ignored.
- `processed/` contains generated JSONL chunks and corpus manifests and is intentionally git-ignored.

The first ingestion output is staged as `NEEDS_REVIEW`. It is not an active or legally validated corpus. Check each source version, extracted text, section labels, and page references before loading the chunks into the retrieval database.

With the RAG service image running, prepare the initial corpus from the repository root:

```powershell
docker compose -f infra/docker/docker-compose.yml exec rag-fastapi ipsakti-ingest --manifest /workspace/data/manifests/india-patent-mvp.yaml --data-root /workspace/data
```

To rebuild chunks from previously downloaded, checksum-verified files without contacting the source portals, add `--offline`.

Output is written to `data/processed/india-patent-mvp-2026-09-28-v1/` on the host. Original source files are written beneath `data/raw/`.
