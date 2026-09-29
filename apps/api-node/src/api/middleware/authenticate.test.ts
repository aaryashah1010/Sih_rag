import express from "express";
import request from "supertest";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../../application/auth.service.js";
import type { Role } from "../../domain/types.js";
import { errorHandler } from "./error-handler.js";
import { authenticate, requireRole } from "./authenticate.js";
import { requestContext } from "./request-context.js";

function roleApp(userRole: Role | null, requiredRole: "USER" | "EXPERT" | "ADMIN", authenticateFirst = true) {
  const app = express();
  app.use(requestContext(pino({ level: "silent" })));

  if (authenticateFirst) {
    const auth = {
      verifyAccessToken: vi.fn(() => ({ userId: "user-123", role: userRole! })),
    } as unknown as AuthService;
    app.get("/guarded", authenticate(auth), requireRole(requiredRole), (_request, response) => {
      response.status(204).end();
    });
  } else {
    app.get("/guarded", requireRole(requiredRole), (_request, response) => {
      response.status(204).end();
    });
  }

  app.use(errorHandler);
  return app;
}

describe("requireRole middleware", () => {
  it("allows USER when USER is required", async () => {
    expect((await request(roleApp("USER", "USER")).get("/guarded").set("Authorization", "Bearer valid-token")).status).toBe(204);
  });

  it("allows EXPERT when EXPERT is required", async () => {
    expect((await request(roleApp("EXPERT", "EXPERT")).get("/guarded").set("Authorization", "Bearer valid-token")).status).toBe(204);
  });

  it("allows ADMIN when ADMIN is required", async () => {
    expect((await request(roleApp("ADMIN", "ADMIN")).get("/guarded").set("Authorization", "Bearer valid-token")).status).toBe(204);
  });

  it.each([
    ["USER", "EXPERT"],
    ["USER", "ADMIN"],
    ["EXPERT", "ADMIN"],
  ] as const)("rejects %s when %s is required", async (userRole, requiredRole) => {
    const response = await request(roleApp(userRole, requiredRole)).get("/guarded").set("Authorization", "Bearer valid-token");
    expect(response.status).toBe(403);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("FORBIDDEN");
    expect(response.body.detail).toBe("This action requires a different role.");
    expect(JSON.stringify(response.body)).not.toContain(userRole);
  });

  it("returns the standard unauthenticated error when AuthContext is missing", async () => {
    const response = await request(roleApp(null, "ADMIN", false)).get("/guarded");
    expect(response.status).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("ACCESS_TOKEN_INVALID");
  });
});
