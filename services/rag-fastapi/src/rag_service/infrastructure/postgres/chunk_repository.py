from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from rag_service.ports.retrieval import EvidenceChunk, SearchQuery

# docs/08-RAG-AND-RETRIEVAL.md s.6's weights (0.45 vector / 0.35 lexical / 0.20 domain boost).
# The domain boost term isn't implemented yet, so these two don't sum to 1 - that's fine, only
# relative order matters for ranking. Config-driven per docs/20-CONFIG-SPEC.md; not wired to
# settings yet because nothing else in retrieval.* config is wired either (no reranker stage
# exists yet either) — revisit together when P1.7/P2 land.
VECTOR_WEIGHT = 0.45
LEXICAL_WEIGHT = 0.35

_LEXICAL_SQL = """
    SELECT c.id AS chunk_id, ts_rank(c.search_vector, websearch_to_tsquery('simple', :query_text)) AS score
    FROM rag.chunks c
    JOIN rag.corpus_members cm ON cm.document_version_id = c.document_version_id
    JOIN rag.corpus_versions cv ON cv.id = cm.corpus_version_id AND cv.status = 'ACTIVE'
    JOIN rag.document_versions dv ON dv.id = c.document_version_id
    JOIN rag.documents d ON d.id = dv.document_id
    JOIN rag.sources s ON s.id = d.source_id
    WHERE s.jurisdiction_code = :jurisdiction
      AND (array_length((:legal_domains)::text[], 1) IS NULL OR s.legal_domain_code = ANY((:legal_domains)::text[]))
      AND c.search_vector @@ websearch_to_tsquery('simple', :query_text)
    ORDER BY score DESC
    LIMIT :limit
"""

_VECTOR_SQL = """
    SELECT c.id AS chunk_id, 1 - (ce.embedding <=> (:query_vector)::vector) AS score
    FROM rag.chunk_embeddings ce
    JOIN rag.chunks c ON c.id = ce.chunk_id
    JOIN rag.corpus_members cm ON cm.document_version_id = c.document_version_id
    JOIN rag.corpus_versions cv ON cv.id = cm.corpus_version_id AND cv.status = 'ACTIVE'
    JOIN rag.document_versions dv ON dv.id = c.document_version_id
    JOIN rag.documents d ON d.id = dv.document_id
    JOIN rag.sources s ON s.id = d.source_id
    WHERE s.jurisdiction_code = :jurisdiction
      AND (array_length((:legal_domains)::text[], 1) IS NULL OR s.legal_domain_code = ANY((:legal_domains)::text[]))
      AND ce.model_name = cv.embedding_model
    ORDER BY ce.embedding <=> (:query_vector)::vector
    LIMIT :limit
"""

_CHUNK_DETAILS_SQL = """
    SELECT
        c.id AS chunk_id, c.document_version_id, c.text, c.language, c.low_quality,
        c.page_start, c.page_end, sec.label AS section_label,
        s.authority_name, s.jurisdiction_code, s.legal_domain_code, s.canonical_url AS source_url,
        d.title AS document_title
    FROM rag.chunks c
    LEFT JOIN rag.sections sec ON sec.id = c.section_id
    JOIN rag.document_versions dv ON dv.id = c.document_version_id
    JOIN rag.documents d ON d.id = dv.document_id
    JOIN rag.sources s ON s.id = d.source_id
    WHERE c.id = ANY(:chunk_ids::uuid[])
"""


def _normalize(scores: dict[str, float]) -> dict[str, float]:
    if not scores:
        return {}
    low, high = min(scores.values()), max(scores.values())
    if high == low:
        return dict.fromkeys(scores, 1.0)
    return {chunk_id: (score - low) / (high - low) for chunk_id, score in scores.items()}


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(repr(float(value)) for value in values) + "]"


class PostgresChunkRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def hybrid_search(self, query: SearchQuery) -> list[EvidenceChunk]:
        legal_domains = list(query.legal_domains)
        async with self._engine.connect() as conn:
            lexical_rows = (await conn.execute(text(_LEXICAL_SQL), {
                "query_text": query.query_text, "jurisdiction": query.jurisdiction,
                "legal_domains": legal_domains, "limit": query.lexical_top_k,
            })).all()
            vector_rows = (await conn.execute(text(_VECTOR_SQL), {
                "query_vector": _vector_literal(query.query_embedding), "jurisdiction": query.jurisdiction,
                "legal_domains": legal_domains, "limit": query.vector_top_k,
            })).all()

            lexical_scores = _normalize({str(row.chunk_id): row.score for row in lexical_rows})
            vector_scores = _normalize({str(row.chunk_id): row.score for row in vector_rows})
            fused: dict[str, float] = {}
            for chunk_id in set(lexical_scores) | set(vector_scores):
                fused[chunk_id] = (
                    LEXICAL_WEIGHT * lexical_scores.get(chunk_id, 0.0)
                    + VECTOR_WEIGHT * vector_scores.get(chunk_id, 0.0)
                )
            if not fused:
                return []

            ranked_ids = sorted(fused, key=lambda chunk_id: fused[chunk_id], reverse=True)[:query.context_top_k]
            detail_rows = (await conn.execute(text(_CHUNK_DETAILS_SQL), {"chunk_ids": ranked_ids})).all()

        details_by_id = {str(row.chunk_id): row for row in detail_rows}
        results: list[EvidenceChunk] = []
        for rank, chunk_id in enumerate(ranked_ids, start=1):
            row = details_by_id.get(chunk_id)
            if row is None:
                continue  # Ranked by a stale index snapshot; skip rather than fail the whole query.
            results.append(EvidenceChunk(
                chunk_id=chunk_id,
                document_version_id=str(row.document_version_id),
                text=row.text,
                section_label=row.section_label,
                authority=row.authority_name,
                document_title=row.document_title,
                source_url=row.source_url,
                jurisdiction=row.jurisdiction_code,
                legal_domain=row.legal_domain_code,
                language=row.language,
                page_start=row.page_start,
                page_end=row.page_end,
                low_quality=row.low_quality,
                lexical_score=lexical_scores.get(chunk_id),
                vector_score=vector_scores.get(chunk_id),
                fused_score=fused[chunk_id],
                rank=rank,
            ))
        return results
