import re
import unicodedata
from pathlib import Path

import pymupdf
from bs4 import BeautifulSoup

from rag_service.ingestion.models import TextPage


def _allowed_script_ratio(text: str, allowed_scripts: list[str]) -> float:
    letters = [char for char in text if unicodedata.category(char).startswith("L")]
    if not letters:
        return 1.0
    allowed = 0
    for char in letters:
        name = unicodedata.name(char, "")
        if any(script in name for script in allowed_scripts):
            allowed += 1
    return allowed / len(letters)


def _filter_disallowed_script_lines(text: str, allowed_scripts: list[str]) -> str:
    return "\n".join(
        line for line in text.splitlines()
        if all(
            not any(script in unicodedata.name(char, "") for script in {"LATIN", "DEVANAGARI"} - set(allowed_scripts))
            for char in line
        )
    ).strip()


def parse_document(path: Path, content_type: str, allowed_scripts: list[str]) -> tuple[list[TextPage], list[int]]:
    if content_type == "application/pdf":
        with pymupdf.open(path) as document:
            pages: list[TextPage] = []
            excluded_pages: list[int] = []
            for index, page in enumerate(document):
                text = page.get_text("text").strip()
                if not text:
                    continue
                page_number = index + 1
                if _allowed_script_ratio(text, allowed_scripts) < 0.5:
                    excluded_pages.append(page_number)
                    continue
                text = _filter_disallowed_script_lines(text, allowed_scripts)
                pages.append(TextPage(page_number=page_number, text=text))
        # Skip arrangement-of-sections pages when the substantive Act begins later.
        for index, page in enumerate(pages):
            if re.search(r"\bACT\s+NO\.", page.text, re.IGNORECASE) and re.search(
                r"\bBE it enacted\b|\benacted by Parliament\b", page.text, re.IGNORECASE
            ):
                return pages[index:], excluded_pages
        return pages, excluded_pages

    if content_type in {"text/html", "application/xhtml+xml"}:
        soup = BeautifulSoup(path.read_bytes(), "html.parser")
        for element in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            element.decompose()
        content = soup.find("main") or soup.find("article") or soup.body or soup
        text = "\n".join(line.strip() for line in content.get_text("\n").splitlines() if line.strip())
        text = _filter_disallowed_script_lines(text, allowed_scripts)
        if not text:
            raise ValueError(f"No readable text extracted from HTML document: {path}")
        if _allowed_script_ratio(text, allowed_scripts) < 0.5:
            return [], [1]
        return [TextPage(page_number=1, text=text)], []

    raise ValueError(f"Unsupported document content type: {content_type}")


SECTION_HEADER = re.compile(
    r"^\s*((?:SECTION\s+)?\d+[A-Za-z]?(?:\([0-9A-Za-z]+\))?\.)\s+(.{3,180}?)(?:\.\s|[—–-]|$)",
    re.IGNORECASE,
)
FOOTNOTE_START = re.compile(
    r"^(?:ins\b|subs?\b|omitted\b|clause\b|sub-clause\b|the proviso\b|the words?\b|the brackets?\b|for the words?\b)",
    re.IGNORECASE,
)


def group_by_legal_section(pages: list[TextPage]) -> list[tuple[str, int, int, str]]:
    groups: list[tuple[str, int, int, list[str]]] = []
    current_label = "Preamble"
    current_start = pages[0].page_number if pages else 1
    current_end = current_start
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        body = "\n".join(current_lines).strip()
        if body:
            groups.append((current_label, current_start, current_end, [body]))
        current_lines = []

    for page in pages:
        current_end = page.page_number
        for line in page.text.splitlines():
            match = SECTION_HEADER.match(line)
            if match and not FOOTNOTE_START.match(match.group(2).strip()):
                flush()
                current_label = f"{match.group(1)} {match.group(2).strip()}"
                current_start = page.page_number
                current_end = page.page_number
                current_lines = [line.strip()]
            else:
                current_lines.append(line.strip())
    flush()
    return [(label, start, end, text[0]) for label, start, end, text in groups]


def split_section(text: str, max_chars: int = 4200) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 2 > max_chars:
            chunks.append(current)
            current = ""
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            sentence_chunk = ""
            for sentence in sentences:
                if sentence_chunk and len(sentence_chunk) + len(sentence) + 1 > max_chars:
                    chunks.append(sentence_chunk)
                    sentence_chunk = ""
                if len(sentence) > max_chars:
                    if sentence_chunk:
                        chunks.append(sentence_chunk)
                        sentence_chunk = ""
                    chunks.extend(sentence[index:index + max_chars] for index in range(0, len(sentence), max_chars))
                else:
                    sentence_chunk = f"{sentence_chunk} {sentence}".strip()
            if sentence_chunk:
                chunks.append(sentence_chunk)
        else:
            current = f"{current}\n\n{paragraph}".strip()
    if current:
        chunks.append(current)
    return chunks
