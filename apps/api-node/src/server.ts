import knex from "knex";
import { pino } from "pino";
import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createPostgresRepositories } from "./infrastructure/postgres/repositories.js";
import { HttpRagClient } from "./infrastructure/rag-http/rag-client.js";

const config = loadConfig();
const logger = pino({ level: config.logLevel });

const db = knex({
  client: "pg",
  connection: config.databaseUrl,
  pool: { min: 0, max: 10 },
  acquireConnectionTimeout: 5_000,
});

const app = buildApp({
  logger,
  repositories: createPostgresRepositories(db),
  rag: new HttpRagClient(config.rag),
  auth: config.auth,
  publicOrigins: config.publicOrigins,
});

const server = app.listen(config.port, config.host, () => {
  logger.info(`Node API listening on ${config.host}:${config.port}`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received; closing Node API`);
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Failed to close Node API cleanly");
      process.exitCode = 1;
    }
    void db.destroy();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
