import { AppError, forbidden, notFound } from "../domain/errors.js";
import { ESCALATION_CONSENT_PURPOSE, type AuthContext, type EscalationCaseDetails, type EscalationCreateRequest, type EscalationCreateResponse, type EscalationGetResponse } from "../domain/types.js";
import type { Repositories } from "../ports/repositories.js";

export class EscalationService {
  constructor(private readonly repositories: Repositories) {}

  async create(auth: AuthContext, input: EscalationCreateRequest, requestId: string): Promise<EscalationCreateResponse> {
    if (auth.role !== "USER") throw forbidden("Only users can create escalations.");
    const sensitive = !!input.include_conversation || input.invention_details !== undefined || !!input.include_contact_information;
    if (input.consent && (!input.consent.granted || input.consent.purpose !== ESCALATION_CONSENT_PURPOSE)) {
      throw new AppError(422, "CONSENT_INVALID", "Invalid consent", "Consent must be granted for escalation review.");
    }
    if (sensitive && !input.consent?.granted) throw new AppError(422, "CONSENT_REQUIRED", "Consent required", "Granted consent is required when including sensitive information.");
    const context = await this.repositories.messages.findEscalationContext(input.answer_id, auth.userId, !!input.include_conversation);
    if (!context) throw notFound("The answer was not found.");
    const user = input.include_contact_information ? await this.repositories.users.findById(auth.userId) : null;
    const casePayload: EscalationCaseDetails = {
      jurisdiction: context.jurisdiction,
      decision: context.answer.decision,
      confidence: context.answer.confidence,
      missing_information: context.answer.missingInformation,
      citations: context.answer.citations.map((citation) => ({ id: citation.label, authority: citation.authority, document: citation.document, locator: citation.locator, page_start: citation.pageStart, page_end: citation.pageEnd, source_url: citation.sourceUrl })),
      ...(input.include_conversation ? { conversation: context.conversation.map((message) => ({ role: message.role, content: message.content, created_at: message.createdAt.toISOString() })) } : {}),
      ...(input.invention_details ? { invention_details: input.invention_details } : {}),
      ...(input.include_contact_information && user?.email ? { contact_information: { email: user.email } } : {}),
    };
    return this.repositories.transaction(async (tx) => {
      const consent = input.consent ? await tx.consents.create({ userId: auth.userId, purpose: input.consent.purpose, noticeVersion: input.consent.notice_version, granted: true }) : null;
      const escalation = await tx.escalations.create({ answerId: input.answer_id, userId: auth.userId, consentRecordId: consent?.id ?? null, reason: input.reason, casePayload });
      if (consent) await tx.audit.record({ requestId, actorType: "USER", actorId: auth.userId, eventType: "consent.granted", entityType: "consent_record", entityId: consent.id, outcome: "success", data: { purpose: consent.purpose, notice_version: consent.noticeVersion } });
      await tx.audit.record({ requestId, actorType: "USER", actorId: auth.userId, eventType: "escalation.created", entityType: "escalation", entityId: escalation.id, outcome: "success", data: { status: escalation.status, consent_recorded: !!consent, includes_conversation: !!input.include_conversation, includes_invention_details: input.invention_details !== undefined, includes_contact_information: !!input.include_contact_information } });
      return { id: escalation.id, status: escalation.status, created_at: escalation.createdAt.toISOString() };
    });
  }

  async get(auth: AuthContext, id: string, requestId: string): Promise<EscalationGetResponse> {
    let escalation = auth.role === "EXPERT" ? await this.repositories.escalations.findForExpert(id, auth.userId)
      : auth.role === "USER" ? await this.repositories.escalations.findForUser(id, auth.userId)
      : await this.repositories.escalations.findById(id);
    if (!escalation) throw notFound("The escalation was not found.");
    if (auth.role === "ADMIN") throw forbidden("This action is not available for this role.");
    if (auth.role !== "USER" && auth.role !== "EXPERT") throw forbidden("This action is not available for this role.");
    await this.repositories.audit.record({ requestId, actorType: auth.role, actorId: auth.userId, eventType: "escalation.read", entityType: "escalation", entityId: id, outcome: "success", data: { status: escalation.status } });
    return { id: escalation.id, status: escalation.status, created_at: escalation.createdAt.toISOString(), answer_id: escalation.answerId, reason: escalation.reason, case_details: escalation.casePayload };
  }
}
