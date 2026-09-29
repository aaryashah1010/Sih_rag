import type { ChatSession, Message, User } from "../domain/types.js";

export const presentUser = (user: User) => ({
  id: user.id,
  email: user.email,
  display_name: user.displayName,
  preferred_language: user.preferredLanguage,
  role: user.role,
  created_at: user.createdAt.toISOString(),
});

export const presentSession = (session: ChatSession) => ({
  id: session.id,
  title: session.title,
  jurisdiction: session.jurisdiction,
  language: session.language,
  status: session.status,
  created_at: session.createdAt.toISOString(),
  updated_at: session.updatedAt.toISOString(),
});

export const presentMessage = (message: Message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  language: message.language,
  created_at: message.createdAt.toISOString(),
});
