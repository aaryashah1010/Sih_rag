import type { ChatSession, ConsentRecord, EscalationCaseDetails, EscalationRecord, Jurisdiction, Message, Page, User } from "../domain/types.js";
import type { RagQueryResponse } from "./rag-client.js";

export interface UserRepository {
  /** Throws a 409 AppError when the email is already registered. */
  createWithPassword(input: { email: string; displayName: string | null; passwordHash: string }): Promise<User>;
  findCredentialsByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  findById(id: string): Promise<User | null>;
  updateProfile(id: string, patch: { displayName?: string | null; preferredLanguage?: string }): Promise<User>;
}

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface RefreshTokenRepository {
  create(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<string>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Revokes `oldId` and inserts its replacement atomically. Returns false if `oldId` was already revoked. */
  rotate(oldId: string, next: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }): Promise<boolean>;
  revokeFamily(familyId: string): Promise<void>;
}

export interface SessionRepository {
  create(input: { userId: string; title: string | null; jurisdiction: Jurisdiction; language: string }): Promise<ChatSession>;
  listForUser(userId: string, cursor: string | null, limit: number): Promise<Page<ChatSession>>;
  findForUser(id: string, userId: string): Promise<ChatSession | null>;
  update(id: string, patch: { title?: string | null; jurisdiction?: Jurisdiction; language?: string; status?: "ACTIVE" | "ARCHIVED" }): Promise<ChatSession>;
  softDelete(id: string): Promise<void>;
  touch(id: string): Promise<void>;
}

export type StoredAnswer = {
  answerId: string;
  assistantMessageId: string;
  decision: RagQueryResponse["decision"];
  answer: string;
  confidence: number | null;
  missingInformation: string[];
  citations: Array<{
    label: string;
    authority: string;
    document: string;
    locator: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    sourceUrl: string | null;
  }>;
};

export interface MessageRepository {
  listForSession(sessionId: string, cursor: string | null, limit: number): Promise<Page<Message>>;
  /** Inserts the user message unless (session, clientMessageId) exists; returns the stored row either way. */
  insertUserMessage(input: {
    sessionId: string;
    content: string;
    language: string;
    clientMessageId: string;
  }): Promise<{ message: Message; created: boolean }>;
  findAnswerForUserMessage(userMessageId: string): Promise<StoredAnswer | null>;
  findEscalationContext(answerId: string, userId: string, includeConversation: boolean): Promise<{ answer: StoredAnswer; jurisdiction: Jurisdiction; conversation: Message[] } | null>;
  /** Persists assistant message, answer, claims and citations in one transaction (idempotent per user message). */
  saveAnswer(input: { sessionId: string; userMessageId: string; language: string; rag: RagQueryResponse }): Promise<StoredAnswer>;
}

export type AuditEvent = {
  requestId?: string;
  actorType: "USER" | "EXPERT" | "ADMIN" | "NODE_API" | "SYSTEM";
  actorId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string;
  outcome?: string;
  data?: Record<string, unknown>;
};

export interface ConsentRepository {
  create(input: { userId: string; purpose: string; noticeVersion: string; granted: boolean }): Promise<ConsentRecord>;
}
export interface EscalationRepository {
  create(input: { answerId: string; userId: string; consentRecordId: string | null; reason: string; casePayload: EscalationCaseDetails }): Promise<EscalationRecord>;
  findById(id: string): Promise<EscalationRecord | null>;
  findForUser(id: string, userId: string): Promise<EscalationRecord | null>;
  findForExpert(id: string, expertId: string): Promise<EscalationRecord | null>;
}
export type EscalationTransaction = { consents: ConsentRepository; escalations: EscalationRepository; audit: AuditRepository };

export interface AuditRepository {
  record(event: AuditEvent): Promise<void>;
}

export type Repositories = {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  sessions: SessionRepository;
  messages: MessageRepository;
  consents: ConsentRepository;
  escalations: EscalationRepository;
  transaction<T>(work: (repositories: EscalationTransaction) => Promise<T>): Promise<T>;
  audit: AuditRepository;
  ping(): Promise<boolean>;
};
