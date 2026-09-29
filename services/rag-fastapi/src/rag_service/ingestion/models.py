from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SourceSpec:
    source_key: str
    title: str
    authority: str
    url: str
    jurisdiction: str
    legal_domain: str
    source_type: str
    expected_content_type: str
    language: str
    indexed_language: str
    allowed_scripts: list[str]
    review_status: str
    notes: str = ""


@dataclass(frozen=True)
class TextPage:
    page_number: int
    text: str


@dataclass(frozen=True)
class CorpusChunk:
    chunk_id: str
    source_key: str
    document_title: str
    authority: str
    source_url: str
    jurisdiction: str
    legal_domain: str
    source_type: str
    language: str
    document_sha256: str
    section_label: str
    page_start: int
    page_end: int
    text: str
    review_status: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
