import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Assigns a request ID (accepting a well-formed incoming X-Request-Id), echoes it, and logs request metadata only. */
export function requestContext(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId(request: IncomingMessage, response) {
      const incoming = request.headers["x-request-id"];
      const id = typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
      response.setHeader("X-Request-Id", id);
      return id;
    },
    // Bodies are never logged: questions may contain confidential invention details.
    serializers: {
      req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      res: (response) => ({ statusCode: response.statusCode }),
    },
    customLogLevel: (_request, response, error) =>
      error || response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
  });
}
