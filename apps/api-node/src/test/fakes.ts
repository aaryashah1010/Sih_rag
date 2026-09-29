import { randomUUID } from "node:crypto";
import { pino } from "pino";
import { buildApp } from "../app.js";
import { conflict } from "../domain/errors.js";
import type { ChatSession, Message, User } from "../domain/types.js";
import type { RagClient, RagQueryResponse } from "../ports/rag-client.js";
import type { RefreshTokenRecord, Repositories, StoredAnswer } from "../ports/repositories.js";

/** In-memory repositories that honour the same contracts as the Postgres implementation. */
export function fakeRepositories() {
  const users = new Map<string, User & { passwordHash: string }>();
  const tokens = new Map<string, RefreshTokenRecord & { tokenHash: string }>();
  const sessions = new Map<string, ChatSession>();
  const messages: Message[] = [];
  const answers = new Map<string, StoredAnswer>();
  const audit: unknown[] = [];

  const repositories: Repositories = {
    ping: async () => true,
    users: {
      async createWithPassword({ email, displayName, passwordHash }) {
        if ([...users.values()].some((user) => user.email === email)) {
          throw conflict("EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
        }
        const user = { id: randomUUID(), email, displayName, preferredLanguage: "en", role: "USER" as const, status: "ACTIVE" as const, createdAt: new Date(), passwordHash };
        users.set(user.id, user);
        return user;
      },
      async findCredentialsByEmail(email) {
        const user = [...users.values()].find((candidate) => candidate.email === email);
        return user ? { user, passwordHash: user.passwordHash } : null;
      },
      async findById(id) {
        return users.get(id) ?? null;
      },
      async updateProfile(id, patch) {
        const user = users.get(id)!;
        if (patch.displayName !== undefined) user.displayName = patch.displayName;
        if (patch.preferredLanguage !== undefined) user.preferredLanguage = patch.preferredLanguage;
        return user;
      },
    },
    refreshTokens: {
      async create({ userId, familyId, tokenHash, expiresAt }) {
        const id = randomUUID();
        tokens.set(id, { id, userId, familyId, tokenHash, expiresAt, revokedAt: null });
        return id;
      },
      async findByHash(tokenHash) {
        return [...tokens.values()].find((token) => token.tokenHash === tokenHash) ?? null;
      },
      async rotate(oldId, next) {
        const old = tokens.get(oldId);
        if (!old || old.revokedAt) return false;
        old.revokedAt = new Date();
        await repositories.refreshTokens.create(next);
        return true;
      },
      async revokeFamily(familyId) {
        for (const token of tokens.values()) if (token.familyId === familyId) token.revokedAt ??= new Date();
      },
    },
    sessions: {
      async create({ userId, title, jurisdiction, language }) {
        const session: ChatSession = { id: randomUUID(), userId, title, jurisdiction, language, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() };
        sessions.set(session.id, session);
        return session;
      },
      async listForUser(userId, _cursor, limit) {
        const items = [...sessions.values()].filter((session) => session.userId === userId && session.status !== "DELETED");
        return { items: items.slice(0, limit), nextCursor: null };
      },
      async findForUser(id, userId) {
        const session = sessions.get(id);
        return session && session.userId === userId && session.status !== "DELETED" ? session : null;
      },
      async update(id, patch) {
        const session = sessions.get(id)!;
        Object.assign(session, patch.title !== undefined ? { title: patch.title } : {}, patch.status ? { status: patch.status } : {});
        return session;
      },
      async softDelete(id) {
        sessions.get(id)!.status = "DELETED";
      },
      async touch() {},
    },
    messages: {
      async listForSession(sessionId, _cursor, limit) {
        return { items: messages.filter((message) => message.sessionId === sessionId).slice(0, limit), nextCursor: null };
      },
      async insertUserMessage({ sessionId, content, language, clientMessageId }) {
        const existing = messages.find((message) => message.sessionId === sessionId && message.clientMessageId === clientMessageId);
        if (existing) return { message: existing, created: false };
        const message: Message = { id: randomUUID(), sessionId, role: "USER", content, language, clientMessageId, createdAt: new Date() };
        messages.push(message);
        return { message, created: true };
      },
      async findAnswerForUserMessage(userMessageId) {
        return answers.get(userMessageId) ?? null;
      },
      async saveAnswer({ sessionId, userMessageId, language, rag }) {
        const stored: StoredAnswer = {
          answerId: randomUUID(),
          assistantMessageId: randomUUID(),
          decision: rag.decision,
          answer: rag.answer,
          confidence: rag.confidence ?? null,
          missingInformation: rag.missing_information,
          citations: rag.citations.map((citation) => ({
            label: citation.label, authority: citation.authority, document: citation.document_title,
            locator: citation.locator ?? null, pageStart: citation.page_start ?? null, pageEnd: citation.page_end ?? null,
            sourceUrl: citation.source_url ?? null,
          })),
        };
        messages.push({ id: stored.assistantMessageId, sessionId, role: "ASSISTANT", content: rag.answer, language, clientMessageId: null, createdAt: new Date() });
        answers.set(userMessageId, stored);
        return stored;
      },
    },
    audit: {
      async record(event) {
        audit.push(event);
      },
    },
  };
  return { repositories, messages, audit, tokens };
}

export const abstainResponse: RagQueryResponse = {
  retrieval_run_id: null,
  corpus_version_id: null,
  decision: "ABSTAIN",
  answer: "The available evidence is insufficient.",
  confidence: null,
  model: { name: "none" },
  policy_version: "test",
  claims: [],
  citations: [],
  missing_information: ["product composition"],
  timings_ms: {},
};

export function fakeRag(handler: () => Promise<RagQueryResponse>) {
  const calls: unknown[] = [];
  const rag: RagClient = {
    async query(request) {
      calls.push(request);
      return handler();
    },
    ready: async () => ({ ok: true, activeCorpus: null }),
  };
  return { rag, calls };
}

export const TEST_AUTH = {
  accessSecret: "test-access-secret-that-is-long-enough-1234",
  accessTtlSeconds: 900,
  refreshTtlDays: 30,
};

export function testApp(rag: RagClient) {
  const fakes = fakeRepositories();
  const app = buildApp({
    logger: pino({ level: "silent" }),
    repositories: fakes.repositories,
    rag,
    auth: TEST_AUTH,
    publicOrigins: ["http://localhost:5173"],
  });
  return { app, ...fakes };
}
