import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_DATABASE_URL: z.string().url(),
  RAG_SERVICE_URL: z.string().url().default("http://rag-fastapi:8000"),
  RAG_SERVICE_TOKEN_SECRET: z.string().min(32, "RAG_SERVICE_TOKEN_SECRET must be at least 32 characters"),
  RAG_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PUBLIC_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Config = {
  env: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: string;
  databaseUrl: string;
  rag: { baseUrl: string; tokenSecret: string; timeoutMs: number };
  auth: { accessSecret: string; accessTtlSeconds: number; refreshTtlDays: number };
  publicOrigins: string[];
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid Node API configuration:\n  ${problems.join("\n  ")}`);
  }
  const env = parsed.data;
  if (env.JWT_ACCESS_SECRET === env.RAG_SERVICE_TOKEN_SECRET) {
    // A shared secret would let a browser access token pass as a service token.
    throw new Error("JWT_ACCESS_SECRET and RAG_SERVICE_TOKEN_SECRET must be different");
  }
  return {
    env: env.NODE_ENV,
    host: "0.0.0.0",
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.NODE_DATABASE_URL,
    rag: { baseUrl: env.RAG_SERVICE_URL, tokenSecret: env.RAG_SERVICE_TOKEN_SECRET, timeoutMs: env.RAG_TIMEOUT_MS },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    },
    publicOrigins: env.PUBLIC_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  };
}
