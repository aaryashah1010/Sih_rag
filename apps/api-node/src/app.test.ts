import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError } from "./domain/errors.js";
import { abstainResponse, fakeRag, TEST_AUTH, testApp } from "./test/fakes.js";

async function signUp(app: Parameters<typeof request>[0], email = "asha@example.com") {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "correct-horse-battery", display_name: "Asha" });
  expect(response.status).toBe(201);
  return response.body as { access_token: string; refresh_token: string; user: { id: string } };
}

describe("auth", () => {
  it("registers, logs in and reads the profile", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    await signUp(app);
    const login = await request(app).post("/api/v1/auth/login").send({ email: "ASHA@example.com", password: "correct-horse-battery" });
    expect(login.status).toBe(200);
    const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${login.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: "asha@example.com", role: "USER", display_name: "Asha" });
    expect(me.body).not.toHaveProperty("password_hash");
  });

  it("rejects a wrong password and a duplicate email with problem details", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    await signUp(app);
    const wrong = await request(app).post("/api/v1/auth/login").send({ email: "asha@example.com", password: "not-the-password" });
    expect(wrong.status).toBe(401);
    expect(wrong.headers["content-type"]).toContain("application/problem+json");
    expect(wrong.body.code).toBe("INVALID_CREDENTIALS");
    const duplicate = await request(app).post("/api/v1/auth/register").send({ email: "asha@example.com", password: "another-password-1" });
    expect(duplicate.status).toBe(409);
  });

  it("rotates refresh tokens and revokes the family when an old token is replayed", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const first = await signUp(app);
    const second = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: first.refresh_token });
    expect(second.status).toBe(200);
    expect(second.body.refresh_token).not.toBe(first.refresh_token);

    const replay = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: first.refresh_token });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("REFRESH_TOKEN_REUSED");

    const afterReplay = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: second.body.refresh_token });
    expect(afterReplay.status).toBe(401);
  });

  it("rejects tokens signed for another audience, such as a service token", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const serviceStyle = jwt.sign({ role: "USER" }, TEST_AUTH.accessSecret, {
      subject: "x", issuer: "ipsakti-api-node", audience: "ipsakti-rag-internal", expiresIn: 60,
    });
    const response = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${serviceStyle}`);
    expect(response.status).toBe(401);
  });

  it("requires authentication for application routes", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    expect((await request(app).get("/api/v1/sessions")).status).toBe(401);
  });
});

describe("sessions", () => {
  it("hides another user's session as 404", async () => {
    const { app } = testApp(fakeRag(async () => abstainResponse).rag);
    const owner = await signUp(app, "owner@example.com");
    const other = await signUp(app, "other@example.com");
    const created = await request(app).post("/api/v1/sessions").set("Authorization", `Bearer ${owner.access_token}`).send({ title: "Neem balm" });
    expect(created.status).toBe(201);
    const peek = await request(app).get(`/api/v1/sessions/${created.body.id}`).set("Authorization", `Bearer ${other.access_token}`);
    expect(peek.status).toBe(404);
  });
});

describe("chat", () => {
  async function withSession(rag: ReturnType<typeof fakeRag>["rag"]) {
    const context = testApp(rag);
    const user = await signUp(context.app);
    const session = await request(context.app).post("/api/v1/sessions").set("Authorization", `Bearer ${user.access_token}`).send({});
    return { ...context, token: user.access_token, sessionId: session.body.id as string };
  }

  it("persists the question, calls RAG once and replays the stored answer for a retried key", async () => {
    const { rag, calls } = fakeRag(async () => abstainResponse);
    const { app, token, sessionId, messages } = await withSession(rag);
    const send = () => request(app).post("/api/v1/chat").set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "retry-key-0001").send({ session_id: sessionId, message: "Can I patent a neem balm?" });

    const first = await send();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ decision: "ABSTAIN", escalation_recommended: false, missing_information: ["product composition"] });
    const retry = await send();
    expect(retry.status).toBe(200);
    expect(retry.body.answer_id).toBe(first.body.answer_id);
    expect(calls).toHaveLength(1);
    expect(messages.filter((message) => message.role === "USER")).toHaveLength(1);
  });

  it("rejects reuse of an idempotency key for a different message", async () => {
    const { app, token, sessionId } = await withSession(fakeRag(async () => abstainResponse).rag);
    const post = (message: string) => request(app).post("/api/v1/chat").set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "same-key-0001").send({ session_id: sessionId, message });
    expect((await post("first question")).status).toBe(200);
    const reused = await post("second question");
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("returns a 503 problem, not an abstention, when the RAG service is down, and keeps the question", async () => {
    const down = fakeRag(async () => {
      throw new AppError(503, "RAG_SERVICE_UNAVAILABLE", "Evidence service unavailable", "unreachable");
    });
    const { app, token, sessionId, messages } = await withSession(down.rag);
    const response = await request(app).post("/api/v1/chat").set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "outage-key-0001").send({ session_id: sessionId, message: "Is turmeric paste patentable?" });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("RAG_SERVICE_UNAVAILABLE");
    expect(messages.filter((message) => message.role === "USER")).toHaveLength(1);

    const history = await request(app).get(`/api/v1/sessions/${sessionId}/messages`).set("Authorization", `Bearer ${token}`);
    expect(history.status).toBe(200);
  });

  it("requires an idempotency key", async () => {
    const { app, token, sessionId } = await withSession(fakeRag(async () => abstainResponse).rag);
    const response = await request(app).post("/api/v1/chat").set("Authorization", `Bearer ${token}`).send({ session_id: sessionId, message: "hi" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });
});
