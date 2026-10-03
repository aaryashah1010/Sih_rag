import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { abstainResponse, fakeRag, TEST_AUTH, testApp } from "./test/fakes.js";

async function signup(app: Parameters<typeof request>[0], email: string) {
  const response = await request(app).post("/api/v1/auth/register").send({ email, password: "correct-horse-battery" });
  return { token: response.body.access_token as string, id: response.body.user.id as string };
}

async function answer(app: Parameters<typeof request>[0], token: string) {
  const session = await request(app).post("/api/v1/sessions").set("Authorization", `Bearer ${token}`).send({});
  const chat = await request(app).post("/api/v1/chat").set("Authorization", `Bearer ${token}`).set("Idempotency-Key", "escalation-test-01")
    .send({ session_id: session.body.id, message: "question body private" });
  return chat.body.answer_id as string;
}

describe("escalations and consent", () => {
  it("creates a non-sensitive escalation without consent and returns 201", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const user = await signup(app, "escalation@example.com");
    const answerId = await answer(app, user.token);
    const response = await request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${user.token}`).send({ answer_id: answerId, reason: "Needs review" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: expect.any(String), status: "OPEN", created_at: expect.any(String) });
  });

  it("requires granted consent for sensitive fields, records it, and excludes payload from audits", async () => {
    const { app, audit, consents, escalations } = testApp(fakeRag(async () => abstainResponse).rag);
    const user = await signup(app, "consent@example.com");
    const answerId = await answer(app, user.token);
    const base = { answer_id: answerId, reason: "Review", invention_details: "secret formula", include_conversation: true, include_contact_information: true };
    expect((await request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${user.token}`).send(base)).status).toBe(422);
    const created = await request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${user.token}`).send({ ...base, consent: { granted: true, purpose: "ESCALATION_REVIEW", notice_version: "v1" } });
    expect(created.status).toBe(201);
    expect(consents.size).toBe(1);
    const row = [...escalations.values()][0]!;
    expect(row.userId).toBe(user.id);
    expect(row.consentRecordId).toBe([...consents.keys()][0]);
    expect(row.casePayload.invention_details).toBe("secret formula");
    expect(row.casePayload.contact_information?.email).toBe("consent@example.com");
    expect(JSON.stringify(audit)).not.toContain("secret formula");
    expect(JSON.stringify(audit)).not.toContain("question body private");
    expect(JSON.stringify(audit)).not.toContain("consent@example.com");
  });

  it("rejects denied or malformed consent and prevents body identity override", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const user = await signup(app, "strict@example.com");
    const answerId = await answer(app, user.token);
    const post = (body: object) => request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${user.token}`).send(body);
    expect((await post({ answer_id: answerId, reason: "x", consent: { granted: false, purpose: "ESCALATION_REVIEW", notice_version: "v1" } })).status).toBe(422);
    expect((await post({ answer_id: answerId, reason: "x", consent: { granted: true, purpose: "wrong", notice_version: "v1" } })).status).toBe(422);
    expect((await post({ answer_id: answerId, reason: "x", user_id: "attacker" })).status).toBe(422);
  });

  it("scopes reads to owners and assigned experts; admin and anonymous callers cannot see case content", async () => {
    const { app, escalations, users } = testApp(fakeRag(async () => abstainResponse).rag);
    const owner = await signup(app, "owner-escalation@example.com");
    const other = await signup(app, "other-escalation@example.com");
    const answerId = await answer(app, owner.token);
    const created = await request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${owner.token}`).send({ answer_id: answerId, reason: "review" });
    const id = created.body.id as string;
    expect((await request(app).get(`/api/v1/escalations/${id}`).set("Authorization", `Bearer ${owner.token}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/escalations/${id}`).set("Authorization", `Bearer ${other.token}`)).status).toBe(404);
    const expertId = "00000000-0000-4000-8000-000000000001";
    users.set(expertId, { id: expertId, email: null, displayName: null, preferredLanguage: "en", role: "EXPERT", status: "ACTIVE", createdAt: new Date(), passwordHash: "" });
    const expertToken = jwt.sign({ role: "EXPERT" }, TEST_AUTH.accessSecret, { subject: expertId, issuer: "ipsakti-api-node", audience: "ipsakti-web", expiresIn: 60 });
    expect((await request(app).get(`/api/v1/escalations/${id}`).set("Authorization", `Bearer ${expertToken}`)).status).toBe(404);
    escalations.get(id)!.assignedExpertId = expertId;
    expect((await request(app).get(`/api/v1/escalations/${id}`).set("Authorization", `Bearer ${expertToken}`)).status).toBe(200);
    const adminToken = jwt.sign({ role: "ADMIN" }, TEST_AUTH.accessSecret, { subject: expertId, issuer: "ipsakti-api-node", audience: "ipsakti-web", expiresIn: 60 });
    expect((await request(app).get(`/api/v1/escalations/${id}`).set("Authorization", `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/escalations/${id}`)).status).toBe(401);
  });

  it("returns problem details for malformed and nonexistent IDs", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const user = await signup(app, "problem@example.com");
    const malformed = await request(app).get("/api/v1/escalations/nope").set("Authorization", `Bearer ${user.token}`);
    expect(malformed.status).toBe(422);
    expect(malformed.headers["content-type"]).toContain("application/problem+json");
    const missing = await request(app).get("/api/v1/escalations/00000000-0000-4000-8000-000000000099").set("Authorization", `Bearer ${user.token}`);
    expect(missing.status).toBe(404);
  });

  it("rolls back consent and audit writes when escalation persistence fails", async () => {
    const { app, repositories, consents, escalations, audit } = testApp(fakeRag(async () => abstainResponse).rag);
    const user = await signup(app, "rollback@example.com");
    const answerId = await answer(app, user.token);
    const previousAuditCount = audit.length;
    repositories.escalations.create = async () => { throw new Error("database failure"); };
    const response = await request(app).post("/api/v1/escalations").set("Authorization", `Bearer ${user.token}`).send({
      answer_id: answerId, reason: "review", invention_details: "private", consent: { granted: true, purpose: "ESCALATION_REVIEW", notice_version: "v1" },
    });
    expect(response.status).toBe(500);
    expect(consents.size).toBe(0);
    expect(escalations.size).toBe(0);
    expect(audit).toHaveLength(previousAuditCount);
  });
});
