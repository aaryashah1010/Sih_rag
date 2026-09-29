import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../domain/errors.js";
import {
  evidenceSearchRequestSchema,
  evidenceSearchResponseSchema,
  type EvidenceSearchRequest,
} from "../../ports/rag-client.js";
import { HttpRagClient, SERVICE_TOKEN_AUDIENCE, SERVICE_TOKEN_ISSUER } from "./rag-client.js";

const request: EvidenceSearchRequest = {
  query: "traditional knowledge patent exclusion",
  jurisdiction: "INDIA",
  legal_domains: ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  limit: 10,
};
const caller = { userId: "user-123", role: "USER", requestId: "request-123" };
const responseBody = {
  corpus_version_id: "f2bc5a7a-573a-4c02-b4c6-c31d570f9fd2",
  results: [{
    chunk_id: "2dbec7d1-117c-4c36-a8f7-195436f9d83b",
    document_title: "Patents Act, 1970",
    authority: "IP India",
    section_label: "Section 3(p)",
    source_url: "https://example.gov.in/source",
    jurisdiction: "INDIA",
    legal_domain: "PATENT",
    language: "en",
    page_start: 12,
    page_end: 13,
    low_quality: false,
    text: "Traditional knowledge exclusion",
    lexical_score: 0.7,
    vector_score: 0.8,
    fused_score: 0.75,
    rank: 1,
  }],
};

const client = () => new HttpRagClient({
  baseUrl: "http://rag.internal:8000",
  tokenSecret: "test-rag-secret",
  timeoutMs: 1000,
});

afterEach(() => vi.unstubAllGlobals());

describe("evidence search contract", () => {
  it("accepts a valid request and response", () => {
    expect(evidenceSearchRequestSchema.safeParse(request).success).toBe(true);
    expect(evidenceSearchResponseSchema.safeParse(responseBody).success).toBe(true);
  });

  it("rejects invalid requests", () => {
    expect(evidenceSearchRequestSchema.safeParse({ ...request, limit: 0 }).success).toBe(false);
    expect(evidenceSearchRequestSchema.safeParse({ ...request, jurisdiction: "MARS" }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(evidenceSearchRequestSchema.safeParse({ ...request, raw_query: "sensitive" }).success).toBe(false);
    expect(evidenceSearchResponseSchema.safeParse({ ...responseBody, debug: true }).success).toBe(false);
  });
});

describe("HttpRagClient.searchEvidence", () => {
  it("sends a signed service token and returns a validated response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().searchEvidence(request, caller);
    expect(result).toEqual(responseBody);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/internal/v1/evidence/search");
    expect(JSON.parse(String(init.body))).toEqual(request);
    expect(new Headers(init.headers).get("x-request-id")).toBe(caller.requestId);
    const token = new Headers(init.headers).get("authorization")!.replace("Bearer ", "");
    expect(jwt.verify(token, "test-rag-secret", {
      algorithms: ["HS256"], issuer: SERVICE_TOKEN_ISSUER, audience: SERVICE_TOKEN_AUDIENCE,
    })).toMatchObject({ uid: caller.userId, roles: [caller.role], sub: "api-node" });
  });

  it("maps a FastAPI outage to 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(client().searchEvidence(request, caller)).rejects.toMatchObject({
      status: 503, code: "RAG_SERVICE_UNAVAILABLE",
    } satisfies Partial<AppError>);
  });

  it("maps a timeout to 504", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }));
    await expect(client().searchEvidence(request, caller)).rejects.toMatchObject({
      status: 504, code: "RAG_TIMEOUT",
    } satisfies Partial<AppError>);
  });
});
