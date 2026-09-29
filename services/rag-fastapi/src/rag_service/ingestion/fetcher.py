from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from time import sleep
from urllib.parse import urlparse

import httpx

from rag_service.ingestion.models import SourceSpec

ALLOWED_HOSTS = {"indiacode.nic.in", "www.indiacode.nic.in", "ipindia.gov.in", "www.ipindia.gov.in"}
MAX_DOCUMENT_BYTES = 50 * 1024 * 1024


@dataclass(frozen=True)
class FetchedArtifact:
    path: Path
    sha256_hex: str
    retrieved_at: str
    content_type: str
    byte_count: int
    final_url: str
    http_status: int | None
    etag: str | None
    last_modified: str | None
    retrieval_mode: str


def fetch_source(source: SourceSpec, raw_root: Path) -> FetchedArtifact:
    host = (urlparse(source.url).hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise ValueError(f"Source host is not allowlisted: {host}")

    headers = {"User-Agent": "IP-SAKTI-Sahayak-CorpusIngestor/0.1 (official-source research)"}
    with httpx.Client(timeout=httpx.Timeout(45.0), follow_redirects=True, headers=headers) as client:
        for attempt in range(3):
            try:
                response = client.get(source.url)
                if response.status_code not in {429, 500, 502, 503, 504}:
                    response.raise_for_status()
                    break
                if attempt == 2:
                    response.raise_for_status()
            except (httpx.TimeoutException, httpx.ConnectError):
                if attempt == 2:
                    raise
            sleep(0.5 * (attempt + 1))
        final_host = (urlparse(str(response.url)).hostname or "").lower()
        if final_host not in ALLOWED_HOSTS:
            raise ValueError(f"Redirect target is not allowlisted: {final_host}")
        body = response.content

    if not body:
        raise ValueError(f"Downloaded empty source: {source.source_key}")
    if len(body) > MAX_DOCUMENT_BYTES:
        raise ValueError(f"Source exceeds {MAX_DOCUMENT_BYTES} byte limit: {source.source_key}")

    received_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    expected_type = source.expected_content_type.lower()
    if expected_type not in received_type and not (expected_type == "application/pdf" and body.startswith(b"%PDF-")):
        raise ValueError(
            f"Unexpected content type for {source.source_key}: expected {expected_type}, got {received_type or 'unknown'}"
        )

    digest = sha256(body).hexdigest()
    extension = ".pdf" if body.startswith(b"%PDF-") else ".html"
    destination = raw_root / source.source_key / digest / f"original{extension}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(body)

    return FetchedArtifact(
        path=destination,
        sha256_hex=digest,
        retrieved_at=datetime.now(timezone.utc).isoformat(),
        content_type=received_type,
        byte_count=len(body),
        final_url=str(response.url),
        http_status=response.status_code,
        etag=response.headers.get("etag"),
        last_modified=response.headers.get("last-modified"),
        retrieval_mode="FETCHED",
    )


def load_cached_source(source: SourceSpec, raw_root: Path) -> FetchedArtifact:
    candidates = sorted((raw_root / source.source_key).glob("*/original.*"), key=lambda item: item.stat().st_mtime)
    if not candidates:
        raise FileNotFoundError(f"No cached source artifact found for {source.source_key}")
    path = candidates[-1]
    body = path.read_bytes()
    digest = sha256(body).hexdigest()
    if path.parent.name != digest:
        raise ValueError(f"Cached artifact checksum does not match its directory: {path}")
    content_type = "application/pdf" if body.startswith(b"%PDF-") else "text/html"
    if content_type != source.expected_content_type.lower():
        raise ValueError(f"Cached artifact type does not match manifest for {source.source_key}")
    modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    return FetchedArtifact(
        path=path,
        sha256_hex=digest,
        retrieved_at=modified_at,
        content_type=content_type,
        byte_count=len(body),
        final_url=source.url,
        http_status=None,
        etag=None,
        last_modified=None,
        retrieval_mode="CACHED",
    )
