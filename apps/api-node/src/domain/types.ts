export const ROLES = ["USER", "EXPERT", "ADMIN", "INGESTION_SERVICE", "EVALUATION"] as const;
export type Role = (typeof ROLES)[number];

export const JURISDICTIONS = ["INDIA", "INTERNATIONAL"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const DECISIONS = ["PASS", "PASS_WITH_CAUTION", "ABSTAIN", "ESCALATE"] as const;
export type Decision = (typeof DECISIONS)[number];

export const ESCALATION_STATUSES = ["OPEN", "ASSIGNED", "IN_REVIEW", "RESOLVED", "CLOSED", "CANCELLED"] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];
export const ESCALATION_CONSENT_PURPOSE = "ESCALATION_REVIEW" as const;

export type EscalationConsentInput = {
  granted: boolean;
  purpose: typeof ESCALATION_CONSENT_PURPOSE;
  notice_version: string;
};

export type ConsentRecord = {
  id: string;
  userId: string;
  purpose: string;
  noticeVersion: string;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type EscalationCreateRequest = {
  answer_id: string;
  reason: string;
  include_conversation?: boolean;
  invention_details?: string;
  include_contact_information?: boolean;
  consent?: EscalationConsentInput;
};

export type EscalationCaseDetails = {
  jurisdiction: Jurisdiction;
  decision: Decision;
  confidence: number | null;
  missing_information: string[];
  citations: Array<{
    id: string;
    authority: string;
    document: string;
    locator: string | null;
    page_start: number | null;
    page_end: number | null;
    source_url: string | null;
  }>;
  conversation?: Array<{ role: Message["role"]; content: string; created_at: string }>;
  invention_details?: string;
  contact_information?: { email: string };
};

export type EscalationRecord = {
  id: string;
  answerId: string | null;
  userId: string | null;
  assignedExpertId: string | null;
  consentRecordId: string | null;
  reason: string;
  casePayload: EscalationCaseDetails;
  status: EscalationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type EscalationCreateResponse = { id: string; status: EscalationStatus; created_at: string };

export type EscalationGetResponse = {
  id: string;
  status: EscalationStatus;
  created_at: string;
  answer_id: string | null;
  reason: string;
  case_details: EscalationCaseDetails;
};

export type User = {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredLanguage: string;
  role: Role;
  status: "ACTIVE" | "DISABLED" | "DELETED";
  createdAt: Date;
};

export type ChatSession = {
  id: string;
  userId: string | null;
  title: string | null;
  jurisdiction: Jurisdiction;
  language: string;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  language: string | null;
  clientMessageId: string | null;
  createdAt: Date;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type AuthContext = { userId: string; role: Role };
