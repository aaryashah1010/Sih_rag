import type { ErrorRequestHandler, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors.js";

const PROBLEM_BASE = "https://ipsakti.example/problems/";

function sendProblem(request: Request, response: Response, status: number, code: string, title: string, detail: string): void {
  response
    .status(status)
    .type("application/problem+json")
    .json({
      type: PROBLEM_BASE + code.toLowerCase().replaceAll("_", "-"),
      title,
      status,
      detail,
      instance: request.originalUrl.split("?")[0],
      request_id: request.id,
      code,
    });
}

export const notFoundHandler = (request: Request, response: Response): void =>
  sendProblem(request, response, 404, "NOT_FOUND", "Not found", "No route matches this request.");

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof AppError) {
    sendProblem(request, response, error.status, error.code, error.title, error.message);
    return;
  }
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join(".") || "body"))].join(", ");
    sendProblem(request, response, 422, "VALIDATION_FAILED", "Invalid request", `Invalid fields: ${fields}`);
    return;
  }
  if (error?.type === "entity.parse.failed") {
    sendProblem(request, response, 400, "MALFORMED_JSON", "Malformed request", "The request body is not valid JSON.");
    return;
  }
  if (error?.type === "entity.too.large") {
    sendProblem(request, response, 413, "PAYLOAD_TOO_LARGE", "Payload too large", "The request body exceeds the size limit.");
    return;
  }
  request.log?.error({ err: error }, "Unhandled API error");
  sendProblem(request, response, 500, "INTERNAL_ERROR", "Internal Server Error", "The request could not be completed.");
};
