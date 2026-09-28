import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Unhandled API error", error);
  response.status(500).json({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "The request could not be completed.",
  });
};
