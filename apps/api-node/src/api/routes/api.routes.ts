import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthService } from "../../application/auth.service.js";
import type { ChatService } from "../../application/chat.service.js";
import type { EvidenceSearchService } from "../../application/evidence-search.service.js";
import { AppError } from "../../domain/errors.js";
import type { Repositories } from "../../ports/repositories.js";
import { authController } from "../controllers/auth.controller.js";
import { chatController } from "../controllers/chat.controller.js";
import { evidenceSearchController } from "../controllers/evidence-search.controller.js";
import { sessionController } from "../controllers/session.controller.js";
import { authContext, authenticate, requireRole } from "../middleware/authenticate.js";

type Deps = { auth: AuthService; chat: ChatService; evidenceSearch: EvidenceSearchService; repositories: Repositories };

const tooManyRequests = () => {
  throw new AppError(429, "RATE_LIMITED", "Too many requests", "Too many requests. Try again later.");
};

export function apiRouter({ auth, chat, evidenceSearch, repositories }: Deps): Router {
  const router = Router();
  const authHandlers = authController(auth, repositories.users);
  const sessions = sessionController(repositories.sessions, repositories.messages);
  const chatHandlers = chatController(chat);
  const evidenceSearchHandlers = evidenceSearchController(evidenceSearch);

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, handler: tooManyRequests });
  const chatLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (_request, response) => authContext(response).userId,
    handler: tooManyRequests,
  });
  const evidenceSearchLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (_request, response) => authContext(response).userId,
    handler: tooManyRequests,
  });

  router.post("/auth/register", authLimiter, authHandlers.register);
  router.post("/auth/login", authLimiter, authHandlers.login);
  router.post("/auth/refresh", authLimiter, authHandlers.refresh);
  router.post("/auth/logout", authHandlers.logout);

  router.use(authenticate(auth));

  router.get("/me", authHandlers.me);
  router.patch("/me", authHandlers.updateMe);

  router.post("/sessions", sessions.create);
  router.get("/sessions", sessions.list);
  router.get("/sessions/:sessionId", sessions.get);
  router.patch("/sessions/:sessionId", sessions.update);
  router.delete("/sessions/:sessionId", sessions.remove);
  router.get("/sessions/:sessionId/messages", sessions.listMessages);

  router.post("/chat", chatLimiter, chatHandlers.ask);
  router.post("/evidence/search", requireRole("USER", "EXPERT", "ADMIN"), evidenceSearchLimiter, evidenceSearchHandlers.search);

  return router;
}
