/** An error returned to the client as an RFC 9457 Problem Details body. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    detail: string,
  ) {
    super(detail);
  }
}

export const unauthorized = (code: string, detail: string) =>
  new AppError(401, code, "Authentication required", detail);
export const forbidden = (detail: string) => new AppError(403, "FORBIDDEN", "Forbidden", detail);
export const notFound = (detail: string) => new AppError(404, "NOT_FOUND", "Not found", detail);
export const conflict = (code: string, detail: string) => new AppError(409, code, "Conflict", detail);
