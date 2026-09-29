import jwt from "jsonwebtoken";
import { AppError } from "../../domain/errors.js";
import {
  ragQueryResponseSchema,
  type RagCaller,
  type RagClient,
  type RagQueryRequest,
  type RagQueryResponse,
} from "../../ports/rag-client.js";

export const SERVICE_TOKEN_ISSUER = "ipsakti-api-node";
export const SERVICE_TOKEN_AUDIENCE = "ipsakti-rag-internal";

type Options = { baseUrl: string; tokenSecret: string; timeoutMs: number };

// Codes FastAPI may return that are safe to pass through to the public error body.
const PASS_THROUGH_CODES = new Set(["RAG_CORPUS_UNAVAILABLE", "RAG_RETRIEVAL_UNAVAILABLE"]);

export class HttpRagClient implements RagClient {
  constructor(private readonly options: Options) {}

  private serviceToken(caller: RagCaller): string {
    return jwt.sign({ uid: caller.userId, roles: [caller.role] }, this.options.tokenSecret, {
      algorithm: "HS256",
      subject: "api-node",
      issuer: SERVICE_TOKEN_ISSUER,
      audience: SERVICE_TOKEN_AUDIENCE,
      expiresIn: 60,
    });
  }

  async query(request: RagQueryRequest, caller: RagCaller): Promise<RagQueryResponse> {
    let response: Response;
    try {
      response = await fetch(new URL("/internal/v1/rag/query", this.options.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.serviceToken(caller)}`,
          "x-request-id": caller.requestId,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new AppError(504, "RAG_TIMEOUT", "Evidence service timed out",
          "No answer was generated because the evidence service did not respond in time.");
      }
      throw new AppError(503, "RAG_SERVICE_UNAVAILABLE", "Evidence service unavailable",
        "No answer was generated because the evidence service is unreachable.");
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = (body as { code?: unknown } | null)?.code;
      if (response.status === 503 && typeof code === "string" && PASS_THROUGH_CODES.has(code)) {
        const detail = (body as { detail?: unknown }).detail;
        throw new AppError(503, code, "Evidence service unavailable",
          `No answer was generated. ${typeof detail === "string" ? detail : ""}`.trim());
      }
      throw new AppError(502, "RAG_BAD_RESPONSE", "Evidence service error",
        "No answer was generated because the evidence service returned an error.");
    }

    const parsed = ragQueryResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(502, "RAG_BAD_RESPONSE", "Evidence service error",
        "No answer was generated because the evidence service returned an invalid response.");
    }
    return parsed.data;
  }

  async ready(): Promise<{ ok: boolean; activeCorpus: string | null }> {
    try {
      const response = await fetch(new URL("/internal/v1/ready", this.options.baseUrl), {
        signal: AbortSignal.timeout(2_000),
      });
      const body = (await response.json().catch(() => ({}))) as { active_corpus?: string | null };
      return { ok: response.ok, activeCorpus: body.active_corpus ?? null };
    } catch {
      return { ok: false, activeCorpus: null };
    }
  }
}
