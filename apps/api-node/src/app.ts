import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await registerHealthRoutes(app);
  return app;
}
