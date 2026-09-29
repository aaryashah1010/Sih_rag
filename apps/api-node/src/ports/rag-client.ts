import { z } from "zod";
import { DECISIONS } from "../domain/types.js";

export type RagQueryRequest = {
  request_id: string;
  trace_id: string;
  session_id: string;
  message_id: string;
  query: string;
  jurisdiction: "INDIA" | "INTERNATIONAL";
  language: string;
  product_context: Record<string, unknown>;
};

export const evidenceSearchRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  jurisdiction: z.enum(["INDIA", "INTERNATIONAL"]),
  legal_domains: z.array(z.string()),
  limit: z.number().int().min(1).max(50),
}).strict();

export type EvidenceSearchRequest = z.infer<typeof evidenceSearchRequestSchema>;

export const evidenceSearchResultSchema = z.object({
  chunk_id: z.string().uuid(),
  document_title: z.string(),
  authority: z.string(),
  section_label: z.string().nullable(),
  source_url: z.string().nullable(),
  jurisdiction: z.string(),
  legal_domain: z.string(),
  language: z.string(),
  page_start: z.number().int().nullable(),
  page_end: z.number().int().nullable(),
  low_quality: z.boolean(),
  text: z.string(),
  lexical_score: z.number().nullable(),
  vector_score: z.number().nullable(),
  fused_score: z.number(),
  rank: z.number().int(),
}).strict();

export const evidenceSearchResponseSchema = z.object({
  corpus_version_id: z.string().uuid(),
  results: z.array(evidenceSearchResultSchema),
}).strict();

export type EvidenceSearchResponse = z.infer<typeof evidenceSearchResponseSchema>;

export const ragCitationSchema = z.object({
  label: z.string(),
  chunk_id: z.string().uuid(),
  authority: z.string(),
  document_title: z.string(),
  locator: z.string().nullable().optional(),
  quoted_span: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  page_start: z.number().int().nullable().optional(),
  page_end: z.number().int().nullable().optional(),
});

export const ragClaimSchema = z.object({
  claim_index: z.number().int().nonnegative(),
  claim_text: z.string(),
  support_status: z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "NOT_APPLICABLE"]),
  verifier_score: z.number().min(0).max(1).nullable().optional(),
  citation_labels: z.array(z.string()).default([]),
});

export const ragQueryResponseSchema = z.object({
  retrieval_run_id: z.string().uuid().nullable(),
  corpus_version_id: z.string().uuid().nullable(),
  decision: z.enum(DECISIONS),
  answer: z.string(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  model: z.object({ name: z.string(), version: z.string().nullable().optional() }),
  policy_version: z.string(),
  claims: z.array(ragClaimSchema).default([]),
  citations: z.array(ragCitationSchema).default([]),
  missing_information: z.array(z.string()).default([]),
  timings_ms: z.record(z.number()).default({}),
});

export type RagQueryResponse = z.infer<typeof ragQueryResponseSchema>;

export type RagCaller = { userId: string; role: string; requestId: string };

export interface RagClient {
  query(request: RagQueryRequest, caller: RagCaller): Promise<RagQueryResponse>;
  searchEvidence(request: EvidenceSearchRequest, caller: RagCaller): Promise<EvidenceSearchResponse>;
  ready(): Promise<{ ok: boolean; activeCorpus: string | null }>;
}
