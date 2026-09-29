import { Router } from "express";
import type { RagClient } from "../../ports/rag-client.js";
import { getHealth, readinessController } from "../controllers/health.controller.js";

export function healthRouter(ping: () => Promise<boolean>, rag: RagClient): Router {
  const router = Router();
  router.get("/healthz", getHealth);
  router.get("/readyz", readinessController(ping, rag));
  return router;
}
