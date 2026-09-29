import { conflict, notFound } from "../domain/errors.js";
import type { AuthContext, Jurisdiction } from "../domain/types.js";
import type { RagClient } from "../ports/rag-client.js";
import type { AuditRepository, MessageRepository, SessionRepository, StoredAnswer } from "../ports/repositories.js";

export const DISCLAIMER = "Information and guidance only; not legal advice.";

export type ChatInput = {
  sessionId: string;
  clientMessageId: string;
  message: string;
  jurisdiction?: Jurisdiction;
  language?: string;
  productContext: Record<string, unknown>;
};

export type ChatResponse = {
  request_id: string;
  message_id: string;
  answer_id: string;
  decision: StoredAnswer["decision"];
  answer: string;
  confidence: number | null;
  citations: Array<{
    id: string;
    authority: string;
    document: string;
    locator: string | null;
    page_start: number | null;
    page_end: number | null;
    source_url: string | null;
  }>;
  missing_information: string[];
  escalation_recommended: boolean;
  disclaimer: string;
};

export class ChatService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly messages: MessageRepository,
    private readonly audit: AuditRepository,
    private readonly rag: RagClient,
  ) {}

  async ask(auth: AuthContext, input: ChatInput, requestId: string): Promise<ChatResponse> {
    const session = await this.sessions.findForUser(input.sessionId, auth.userId);
    if (!session) throw notFound("The session does not exist.");

    const language = input.language ?? session.language;
    // The user message is stored before FastAPI is called, so a RAG outage never loses the question.
    const { message, created } = await this.messages.insertUserMessage({
      sessionId: session.id,
      content: input.message,
      language,
      clientMessageId: input.clientMessageId,
    });
    if (!created && message.content !== input.message) {
      throw conflict("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different message.");
    }
    if (!created) {
      const previous = await this.messages.findAnswerForUserMessage(message.id);
      if (previous) return this.toResponse(requestId, message.id, previous);
    }

    try {
      const rag = await this.rag.query(
        {
          request_id: requestId,
          trace_id: requestId,
          session_id: session.id,
          message_id: message.id,
          query: input.message,
          jurisdiction: input.jurisdiction ?? session.jurisdiction,
          language,
          product_context: input.productContext,
        },
        { userId: auth.userId, role: auth.role, requestId },
      );
      const stored = await this.messages.saveAnswer({ sessionId: session.id, userMessageId: message.id, language, rag });
      await this.sessions.touch(session.id);
      await this.audit.record({
        requestId, actorType: "USER", actorId: auth.userId, eventType: "chat.answer",
        entityType: "answer", entityId: stored.answerId, outcome: stored.decision,
      });
      return this.toResponse(requestId, message.id, stored);
    } catch (error) {
      await this.audit.record({
        requestId, actorType: "USER", actorId: auth.userId, eventType: "chat.answer",
        entityType: "message", entityId: message.id, outcome: "FAILED",
        data: { code: (error as { code?: string }).code ?? "UNEXPECTED" },
      }).catch(() => undefined);
      throw error;
    }
  }

  private toResponse(requestId: string, messageId: string, stored: StoredAnswer): ChatResponse {
    return {
      request_id: requestId,
      message_id: messageId,
      answer_id: stored.answerId,
      decision: stored.decision,
      answer: stored.answer,
      confidence: stored.confidence,
      citations: stored.citations.map((citation) => ({
        id: citation.label,
        authority: citation.authority,
        document: citation.document,
        locator: citation.locator,
        page_start: citation.pageStart,
        page_end: citation.pageEnd,
        source_url: citation.sourceUrl,
      })),
      missing_information: stored.missingInformation,
      escalation_recommended: stored.decision === "ESCALATE",
      disclaimer: DISCLAIMER,
    };
  }
}
