import type { Request, Response } from "express";
import type { EscalationService } from "../../application/escalation.service.js";
import { authContext, requestId } from "../middleware/authenticate.js";
import { escalationCreateBody, uuidParam } from "../schemas.js";

export function escalationController(service: EscalationService) {
  return {
    async create(request: Request, response: Response) {
      const body = escalationCreateBody.parse(request.body);
      response.status(201).json(await service.create(authContext(response), body, requestId(request)));
    },
    async get(request: Request, response: Response) {
      const id = uuidParam.parse(request.params.id);
      response.json(await service.get(authContext(response), id, requestId(request)));
    },
  };
}
