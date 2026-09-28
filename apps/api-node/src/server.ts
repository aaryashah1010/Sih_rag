import { buildApp } from "./app.js";
import { config } from "./config/env.js";

const app = buildApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`Node API listening on ${config.host}:${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received; closing Node API`);
  server.close((error) => {
    if (error) {
      console.error("Failed to close Node API cleanly", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
