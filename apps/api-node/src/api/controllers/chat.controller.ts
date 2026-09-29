import type { Request, Response } from "express";
import type { ChatService } from "../../application/chat.service.js";
import { AppError } from "../../domain/errors.js";
import { authContext, requestId } from "../middleware/authenticate.js";
import { chatBody, idempotencyKey } from "../schemas.js";

export function chatController(chat: ChatService) {
  return {
    async ask(request: Request, response: Response) {
      const body = chatBody.parse(request.body);
      const header = request.get("Idempotency-Key");
      const key = header === undefined ? undefined : idempotencyKey.safeParse(header);
      if (key && !key.success) {
        throw new AppError(400, "INVALID_IDEMPOTENCY_KEY", "Invalid Idempotency-Key", "Idempotency-Key must be 8-128 URL-safe characters.");
      }
      const clientMessageId = body.client_message_id ?? key?.data;
      if (!clientMessageId) {
        throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required",
          "Send an Idempotency-Key header or client_message_id so retries do not duplicate messages.");
      }
      const result = await chat.ask(
        authContext(response),
        {
          sessionId: body.session_id,
          clientMessageId,
          message: body.message,
          jurisdiction: body.jurisdiction,
          language: body.language,
          productContext: body.product_context,
        },
        requestId(request),
      );
      response.json(result);
    },
  };
}
