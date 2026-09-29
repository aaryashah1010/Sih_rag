import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

from rag_service.ingestion.fetcher import FetchedArtifact, fetch_source, load_cached_source
from rag_service.ingestion.manifest import load_manifest
from rag_service.ingestion.models import CorpusChunk, SourceSpec
from rag_service.ingestion.parser import group_by_legal_section, parse_document, split_section


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _chunks_for_source(source: SourceSpec, artifact: FetchedArtifact) -> tuple[list[CorpusChunk], list[int]]:
    pages, excluded_pages = parse_document(artifact.path, artifact.content_type, source.allowed_scripts)
    section_groups = group_by_legal_section(pages)
    chunks: list[CorpusChunk] = []
    for section_label, page_start, page_end, section_text in section_groups:
        for text in split_section(section_text):
            identity = f"{source.source_key}:{artifact.sha256_hex}:{section_label}:{page_start}:{len(chunks)}:{text}"
            chunks.append(CorpusChunk(
                chunk_id=sha256(identity.encode("utf-8")).hexdigest(),
                source_key=source.source_key,
                document_title=source.title,
                authority=source.authority,
                source_url=source.url,
                jurisdiction=source.jurisdiction,
                legal_domain=source.legal_domain,
                source_type=source.source_type,
                language=source.indexed_language,
                document_sha256=artifact.sha256_hex,
                section_label=section_label,
                page_start=page_start,
                page_end=page_end,
                text=text,
                review_status=source.review_status,
            ))
    return chunks, excluded_pages


def ingest_manifest(manifest_path: Path, data_root: Path, offline: bool = False) -> Path:
    corpus_version, sources = load_manifest(manifest_path)
    raw_root = data_root / "raw"
    output_dir = data_root / "processed" / corpus_version
    output_dir.mkdir(parents=True, exist_ok=True)

    all_chunks: list[CorpusChunk] = []
    source_records: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []

    for source in sources:
        try:
            artifact = load_cached_source(source, raw_root) if offline else fetch_source(source, raw_root)
            chunks, excluded_pages = _chunks_for_source(source, artifact)
            if not chunks:
                raise ValueError("No text chunks were extracted")
            all_chunks.extend(chunks)
            source_records.append({
                "source_key": source.source_key,
                "title": source.title,
                "authority": source.authority,
                "source_url": source.url,
                "final_url": artifact.final_url,
                "jurisdiction": source.jurisdiction,
                "legal_domain": source.legal_domain,
                "source_type": source.source_type,
                "review_status": source.review_status,
                "source_languages": source.language,
                "indexed_language": source.indexed_language,
                "allowed_scripts": source.allowed_scripts,
                "excluded_pages": excluded_pages,
                "notes": source.notes,
                "sha256": artifact.sha256_hex,
                "retrieved_at": artifact.retrieved_at,
                "http_status": artifact.http_status,
                "retrieval_mode": artifact.retrieval_mode,
                "content_type": artifact.content_type,
                "byte_count": artifact.byte_count,
                "etag": artifact.etag,
                "last_modified": artifact.last_modified,
                "raw_artifact": str(artifact.path),
                "chunk_count": len(chunks),
            })
        except Exception as error:
            failures.append({"source_key": source.source_key, "error": str(error)})

    chunks_path = output_dir / "chunks.jsonl"
    chunks_path.write_text(
        "".join(json.dumps(chunk.to_dict(), ensure_ascii=False) + "\n" for chunk in all_chunks),
        encoding="utf-8",
    )
    manifest_record = {
        "corpus_version": corpus_version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "NEEDS_REVIEW" if not failures else "FAILED",
        "source_count": len(sources),
        "successful_source_count": len(source_records),
        "chunk_count": len(all_chunks),
        "sources": source_records,
        "failures": failures,
        "chunks_file": str(chunks_path),
    }
    _write_json(output_dir / "corpus-manifest.json", manifest_record)
    if failures:
        failed = ", ".join(item["source_key"] for item in failures)
        raise RuntimeError(f"Corpus ingestion failed for: {failed}. See {output_dir / 'corpus-manifest.json'}")
    if not all_chunks:
        raise RuntimeError("Ingestion produced no chunks")
    return output_dir
