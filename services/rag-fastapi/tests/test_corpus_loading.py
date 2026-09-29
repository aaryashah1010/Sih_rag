import json
from pathlib import Path
from uuid import uuid4

import pytest

from rag_service.application.corpus_loading import CorpusLoadError, CorpusLoadingService
from rag_service.ports.corpus_repository import ChunkRecord, DocumentVersionRecord, SourceRecord


class FakeEmbeddings:
    model_name = "fake-embedder"
    model_version = "1"
    dimension = 4

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        return [[float(len(text)), 0.0, 0.0, 0.0] for text in texts]


class FakeRepository:
    def __init__(self) -> None:
        self.sources: dict[str, SourceRecord] = {}
        self.documents: dict[tuple, str] = {}
        self.versions: dict[tuple, str] = {}
        self.replace_calls: list[tuple[str, list[ChunkRecord]]] = []
        self.validated: list[str] = []
        self.corpora: dict[str, dict] = {}
        self.members: dict[str, set[str]] = {}
        self.activated: list[str] = []
        self.failed: list[tuple[str, str]] = []

    async def upsert_source(self, source: SourceRecord) -> str:
        self.sources[source.source_key] = source
        return f"source:{source.source_key}"

    async def upsert_document(self, source_id: str, title: str, external_identifier: str, canonical_url: str) -> str:
        key = (source_id, external_identifier)
        self.documents.setdefault(key, f"document:{external_identifier}")
        return self.documents[key]

    async def get_or_create_document_version(self, document_id: str, version: DocumentVersionRecord):
        key = (document_id, version.sha256)
        if key in self.versions:
            return self.versions[key], False
        self.versions[key] = f"version:{document_id}:{version.sha256[:8]}"
        return self.versions[key], True

    async def replace_chunks(self, document_version_id: str, chunks, model_name: str, model_version: str) -> int:
        self.replace_calls.append((document_version_id, chunks))
        return len(chunks)

    async def mark_document_version_validated(self, document_version_id: str, extraction_quality: float) -> None:
        self.validated.append(document_version_id)

    async def begin_corpus(self, name, manifest_uri, manifest_sha256, embedding_model, embedding_dimension) -> str:
        corpus_id = f"corpus:{name}"
        self.corpora[corpus_id] = {"name": name, "status": "BUILDING"}
        self.members[corpus_id] = set()
        return corpus_id

    async def add_corpus_member(self, corpus_version_id: str, document_version_id: str) -> None:
        self.members[corpus_version_id].add(document_version_id)

    async def mark_corpus_ready(self, corpus_version_id: str) -> None:
        self.corpora[corpus_version_id]["status"] = "READY"

    async def mark_corpus_failed(self, corpus_version_id: str, reason: str) -> None:
        self.corpora[corpus_version_id]["status"] = "FAILED"
        self.failed.append((corpus_version_id, reason))

    async def activate_corpus(self, corpus_version_id: str) -> None:
        assert self.corpora[corpus_version_id]["status"] == "READY"
        self.corpora[corpus_version_id]["status"] = "ACTIVE"
        self.activated.append(corpus_version_id)


def write_fixture(tmp_path: Path, *, chunk_count: int = 3, status: str = "NEEDS_REVIEW") -> Path:
    processed_dir = tmp_path / "corpus"
    processed_dir.mkdir()
    manifest = {
        "corpus_version": "test-corpus-v1",
        "status": status,
        "sources": [{
            "source_key": "ipindia_patents_act_1970",
            "title": "Patents Act, 1970",
            "authority": "IP India",
            "source_url": "https://ipindia.gov.in/x.pdf",
            "jurisdiction": "INDIA",
            "legal_domain": "PATENT",
            "source_type": "LAW",
            "sha256": "a" * 64,
            "retrieved_at": "2026-09-28T00:00:00+00:00",
            "content_type": "application/pdf",
            "raw_artifact": "data/raw/ipindia_patents_act_1970/aa/original.pdf",
        }],
        "failures": [],
    }
    (processed_dir / "corpus-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    lines = [
        json.dumps({
            "chunk_id": str(uuid4()),
            "source_key": "ipindia_patents_act_1970",
            "document_title": "Patents Act, 1970",
            "authority": "IP India",
            "source_url": "https://ipindia.gov.in/x.pdf",
            "jurisdiction": "INDIA",
            "legal_domain": "PATENT",
            "source_type": "LAW",
            "language": "en",
            "section_label": f"{index}. Section {index}",
            "page_start": index,
            "page_end": index,
            "text": f"Section {index} text " * (1 if index != 0 else 20),
            "review_status": "needs_currency_review",
        })
        for index in range(chunk_count)
    ]
    (processed_dir / "chunks.jsonl").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return processed_dir


@pytest.mark.asyncio
async def test_loads_embeds_and_activates(tmp_path):
    repository, embeddings = FakeRepository(), FakeEmbeddings()
    processed_dir = write_fixture(tmp_path)

    result = await CorpusLoadingService(repository, embeddings).load(processed_dir, activate=True)

    assert result.document_versions_loaded == 1
    assert result.document_versions_unchanged == 0
    assert result.chunks_embedded == 3
    assert result.activated is True
    assert repository.corpora[f"corpus:{result.corpus_name}"]["status"] == "ACTIVE"
    assert len(embeddings.calls[0]) == 3
    [(_, chunks)] = repository.replace_calls
    assert [chunk.section_label for chunk in chunks] == ["0. Section 0", "1. Section 1", "2. Section 2"]
    # A chunk built from the long text is not flagged low_quality; the short ones are.
    assert chunks[0].low_quality is False
    assert chunks[1].low_quality is True


@pytest.mark.asyncio
async def test_second_run_with_same_sha256_skips_reembedding(tmp_path):
    repository, embeddings = FakeRepository(), FakeEmbeddings()
    processed_dir = write_fixture(tmp_path)
    service = CorpusLoadingService(repository, embeddings)

    await service.load(processed_dir, activate=False)
    await service.load(processed_dir, activate=False)

    assert len(embeddings.calls) == 1
    assert len(repository.replace_calls) == 1


@pytest.mark.asyncio
async def test_refuses_to_load_a_failed_ingestion_run(tmp_path):
    repository, embeddings = FakeRepository(), FakeEmbeddings()
    processed_dir = write_fixture(tmp_path, status="FAILED")

    with pytest.raises(CorpusLoadError, match="status='FAILED'"):
        await CorpusLoadingService(repository, embeddings).load(processed_dir, activate=False)


@pytest.mark.asyncio
async def test_marks_corpus_failed_when_a_source_has_no_chunks(tmp_path):
    repository, embeddings = FakeRepository(), FakeEmbeddings()
    processed_dir = write_fixture(tmp_path, chunk_count=0)

    with pytest.raises(CorpusLoadError, match="No chunks found"):
        await CorpusLoadingService(repository, embeddings).load(processed_dir, activate=False)

    [(_, status)] = [(cid, corpus["status"]) for cid, corpus in repository.corpora.items()]
    assert status == "FAILED"


@pytest.mark.asyncio
async def test_load_without_activate_leaves_corpus_ready(tmp_path):
    repository, embeddings = FakeRepository(), FakeEmbeddings()
    processed_dir = write_fixture(tmp_path)

    result = await CorpusLoadingService(repository, embeddings).load(processed_dir, activate=False)

    assert result.activated is False
    assert repository.corpora[f"corpus:{result.corpus_name}"]["status"] == "READY"
    assert repository.activated == []
