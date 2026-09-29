import { z } from "zod";
import { JURISDICTIONS } from "../domain/types.js";

const language = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, "must be a language tag such as en or hi");

export const registerBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export const refreshBody = z.object({ refresh_token: z.string().min(20).max(200) }).strict();

export const updateMeBody = z.object({
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  preferred_language: language.optional(),
}).strict();

export const createSessionBody = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
  jurisdiction: z.enum(JURISDICTIONS).default("INDIA"),
  language: language.default("en"),
}).strict();

export const updateSessionBody = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
  jurisdiction: z.enum(JURISDICTIONS).optional(),
  language: language.optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
}).strict();

export const pageQuery = (maxLimit: number, defaultLimit: number) => z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
});

export const uuidParam = z.string().uuid();

export const idempotencyKey = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/, "must be 8-128 URL-safe characters");

export const chatBody = z.object({
  session_id: z.string().uuid(),
  client_message_id: idempotencyKey.optional(),
  message: z.string().trim().min(1).max(4000),
  jurisdiction: z.enum(JURISDICTIONS).optional(),
  language: language.optional(),
  product_context: z.record(z.unknown()).default({}),
}).strict();
