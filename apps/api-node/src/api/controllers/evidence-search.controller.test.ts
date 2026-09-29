import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError } from "../../domain/errors.js";
import { evidenceSearchResponseSchema, type EvidenceSearchRequest, type EvidenceSearchResponse } from "../../ports/rag-client.js";
import { abstainResponse, fakeRag, TEST_AUTH, testApp } from "../../test/fakes.js";

const searchRequest: EvidenceSearchRequest = {
  query: "traditional knowledge patent exclusion",
  jurisdiction: "INDIA",
  legal_domains: ["PATENT", "TRADITIONAL_KNOWLEDGE"],
  limit: 10,
};

const searchResponse: EvidenceSearchResponse = {
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

async function authenticatedApp(evidenceHandler?: Parameters<typeof fakeRag>[1]) {
  const fake = fakeRag(async () => abstainResponse, evidenceHandler);
  const { app } = testApp(fake.rag);
  const registered = await request(app).post("/api/v1/auth/register")
    .send({ email: "evidence@example.com", password: "correct-horse-battery" });
  expect(registered.status).toBe(201);
  return { app, token: registered.body.access_token as string, evidenceCalls: fake.evidenceCalls };
}

const postEvidence = (app: Parameters<typeof request>[0], token?: string) => {
  const call = request(app).post("/api/v1/evidence/search");
  if (token) call.set("Authorization", `Bearer ${token}`);
  return call.send(searchRequest);
};

describe("POST /api/v1/evidence/search", () => {
  it("returns search results and calls the application service through RagClient", async () => {
    const { app, token, evidenceCalls } = await authenticatedApp(async () => searchResponse);
    const response = await postEvidence(app, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(searchResponse);
    expect(evidenceCalls).toHaveLength(1);
    expect(evidenceCalls[0]).toMatchObject({
      request: searchRequest,
      caller: { userId: expect.any(String), role: "USER", requestId: response.headers["x-request-id"] },
    });
  });

  it("rejects invalid and unknown request fields with Problem Details", async () => {
    const { app, token, evidenceCalls } = await authenticatedApp();
    const invalid = await request(app).post("/api/v1/evidence/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...searchRequest, limit: 51 });
    const unknown = await request(app).post("/api/v1/evidence/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...searchRequest, confidential_payload: "must not be accepted" });

    for (const response of [invalid, unknown]) {
      expect(response.status).toBe(422);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.body.code).toBe("VALIDATION_FAILED");
    }
    expect(evidenceCalls).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const { app } = await authenticatedApp();
    const response = await postEvidence(app);
    expect(response.status).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("ACCESS_TOKEN_INVALID");
  });

  it("rejects an authenticated role outside the public role allowlist", async () => {
    const { app } = await authenticatedApp();
    const evaluationToken = jwt.sign({ role: "EVALUATION" }, TEST_AUTH.accessSecret, {
      algorithm: "HS256",
      subject: "evaluation-user",
      issuer: "ipsakti-api-node",
      audience: "ipsakti-web",
      expiresIn: TEST_AUTH.accessTtlSeconds,
    });
    const response = await postEvidence(app, evaluationToken);
    expect(response.status).toBe(403);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("rate limits by authenticated user", async () => {
    const { app, token } = await authenticatedApp();
    let response;
    for (let attempt = 0; attempt < 21; attempt += 1) response = await postEvidence(app, token);

    expect(response!.status).toBe(429);
    expect(response!.headers["content-type"]).toContain("application/problem+json");
    expect(response!.body.code).toBe("RATE_LIMITED");
  });

  it("maps a RAG service outage to 503 Problem Details", async () => {
    const { app, token } = await authenticatedApp(async () => {
      throw new AppError(503, "RAG_CORPUS_UNAVAILABLE", "Evidence service unavailable", "No corpus is active.");
    });
    const response = await postEvidence(app, token);
    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("RAG_CORPUS_UNAVAILABLE");
  });

  it("maps a RAG timeout to 504 Problem Details", async () => {
    const { app, token } = await authenticatedApp(async () => {
      throw new AppError(504, "RAG_TIMEOUT", "Evidence service timed out", "No evidence was returned in time.");
    });
    const response = await postEvidence(app, token);
    expect(response.status).toBe(504);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("RAG_TIMEOUT");
  });

  it("returns the documented evidence result fields", async () => {
    const { app, token } = await authenticatedApp(async () => searchResponse);
    const response = await postEvidence(app, token);

    expect(response.status).toBe(200);
    expect(evidenceSearchResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.results[0]).toMatchObject({
      chunk_id: expect.any(String),
      document_title: expect.any(String),
      authority: expect.any(String),
      jurisdiction: "INDIA",
      legal_domain: "PATENT",
      rank: 1,
    });
  });
});
