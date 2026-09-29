export const ROLES = ["USER", "EXPERT", "ADMIN", "INGESTION_SERVICE", "EVALUATION"] as const;
export type Role = (typeof ROLES)[number];

export const JURISDICTIONS = ["INDIA", "INTERNATIONAL"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const DECISIONS = ["PASS", "PASS_WITH_CAUTION", "ABSTAIN", "ESCALATE"] as const;
export type Decision = (typeof DECISIONS)[number];

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
