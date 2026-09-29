import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { AuthService } from "./application/auth.service.js";
import { ChatService } from "./application/chat.service.js";
import { EscalationService } from "./application/escalation.service.js";
import type { RagClient } from "./ports/rag-client.js";
import type { Repositories } from "./ports/repositories.js";
import { errorHandler, notFoundHandler } from "./api/middleware/error-handler.js";
import { requestContext } from "./api/middleware/request-context.js";
import { apiRouter } from "./api/routes/api.routes.js";
import { healthRouter } from "./api/routes/health.routes.js";

export type AppDeps = {
  logger: Logger;
  repositories: Repositories;
  rag: RagClient;
  auth: { accessSecret: string; accessTtlSeconds: number; refreshTtlDays: number };
  publicOrigins: string[];
};

export function buildApp(deps: AppDeps) {
  const { repositories } = deps;
  const auth = new AuthService(repositories.users, repositories.refreshTokens, repositories.audit, deps.auth);
  const chat = new ChatService(repositories.sessions, repositories.messages, repositories.audit, deps.rag);
  const escalations = new EscalationService(repositories);

  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.publicOrigins, exposedHeaders: ["X-Request-Id"] }));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter(() => repositories.ping(), deps.rag));
  app.use("/api/v1", apiRouter({ auth, chat, escalations, repositories }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
