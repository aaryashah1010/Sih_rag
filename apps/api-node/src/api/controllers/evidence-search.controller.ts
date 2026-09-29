import type { Request, Response } from "express";
import { EvidenceSearchService } from "../../application/evidence-search.service.js";
import { evidenceSearchRequestSchema } from "../../ports/rag-client.js";
import { authContext, requestId } from "../middleware/authenticate.js";

export function evidenceSearchController(service: EvidenceSearchService) {
  return {
    async search(request: Request, response: Response) {
      const body = evidenceSearchRequestSchema.parse(request.body);
      const auth = authContext(response);
      const result = await service.search(body, {
        userId: auth.userId,
        role: auth.role,
        requestId: requestId(request),
      });
      response.status(200).json(result);
    },
  };
}
