from pathlib import Path

import yaml
import re

from rag_service.ingestion.models import SourceSpec


def load_manifest(path: Path) -> tuple[str, list[SourceSpec]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("documents"), list):
        raise ValueError("Manifest must contain a documents list")

    corpus_version = raw.get("corpus_version")
    if not isinstance(corpus_version, str) or not corpus_version.strip():
        raise ValueError("Manifest corpus_version must be a non-empty string")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", corpus_version):
        raise ValueError("Manifest corpus_version may contain only letters, numbers, hyphens, and underscores")

    required = {
        "source_key", "title", "authority", "url", "jurisdiction",
        "legal_domain", "source_type", "expected_content_type", "language",
        "review_status",
    }
    sources: list[SourceSpec] = []
    seen_keys: set[str] = set()
    for item in raw["documents"]:
        if not isinstance(item, dict):
            raise ValueError("Each manifest document must be an object")
        missing = required.difference(item)
        if missing:
            raise ValueError(f"Manifest document missing fields: {', '.join(sorted(missing))}")
        key = str(item["source_key"])
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
            raise ValueError(f"Invalid source_key: {key}")
        if key in seen_keys:
            raise ValueError(f"Duplicate source_key: {key}")
        seen_keys.add(key)
        if not str(item["url"]).startswith("https://"):
            raise ValueError(f"Only HTTPS source URLs are allowed: {key}")
        allowed_scripts = item.get("allowed_scripts", ["LATIN"])
        if not isinstance(allowed_scripts, list) or not allowed_scripts or any(
            script not in {"LATIN", "DEVANAGARI"} for script in allowed_scripts
        ):
            raise ValueError(f"allowed_scripts must contain LATIN and/or DEVANAGARI: {key}")
        sources.append(SourceSpec(
            **{field: item[field] for field in required - {"notes"}},
            indexed_language=item.get("indexed_language", item["language"]),
            allowed_scripts=allowed_scripts,
            notes=item.get("notes", ""),
        ))

    return corpus_version, sources
