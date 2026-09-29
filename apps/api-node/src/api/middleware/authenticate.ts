import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuthService } from "../../application/auth.service.js";
import { forbidden, unauthorized } from "../../domain/errors.js";
import type { AuthContext } from "../../domain/types.js";

export type AuthorizationRole = "USER" | "EXPERT" | "ADMIN";

export function authenticate(auth: AuthService): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw unauthorized("ACCESS_TOKEN_INVALID", "A bearer access token is required.");
    }
    response.locals.auth = auth.verifyAccessToken(token);
    next();
  };
}

export function requireRole(...roles: AuthorizationRole[]): RequestHandler {
  return (_request, response, next) => {
    const role = authContext(response).role;
    if (!roles.some((allowedRole) => allowedRole === role)) throw forbidden("This action requires a different role.");
    next();
  };
}

export function authContext(response: Response): AuthContext {
  const auth = response.locals.auth as AuthContext | undefined;
  if (!auth) throw unauthorized("ACCESS_TOKEN_INVALID", "A bearer access token is required.");
  return auth;
}

export const requestId = (request: Request): string => String(request.id);
