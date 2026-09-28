import express from "express";
import { healthRouter } from "./api/routes/health.routes.js";
import { errorHandler } from "./api/middleware/error-handler.js";

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(errorHandler);
  return app;
}
