import type { Request, Response } from "express";
import type { RagClient } from "../../ports/rag-client.js";

export function getHealth(_request: Request, response: Response): void {
  response.status(200).json({ status: "ok" });
}

/** Ready when PostgreSQL is reachable. RAG state is reported separately: ordinary routes work without it. */
export function readinessController(ping: () => Promise<boolean>, rag: RagClient) {
  return async (_request: Request, response: Response) => {
    const [database, ragState] = await Promise.all([ping(), rag.ready()]);
    response.status(database ? 200 : 503).json({
      status: database ? "ok" : "unavailable",
      database: database ? "ok" : "unavailable",
      chat: ragState.ok ? (ragState.activeCorpus ? "ok" : "no_active_corpus") : "unavailable",
    });
  };
}
