import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { unauthorized } from "../domain/errors.js";
import { ROLES, type AuthContext, type Role, type User } from "../domain/types.js";
import type { AuditRepository, RefreshTokenRepository, UserRepository } from "../ports/repositories.js";

export const ACCESS_TOKEN_ISSUER = "ipsakti-api-node";
export const ACCESS_TOKEN_AUDIENCE = "ipsakti-web";
const BCRYPT_COST = 12;
// Compared against when the email is unknown so login timing does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync("ipsakti-timing-equaliser", BCRYPT_COST);

export type TokenPair = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  refresh_expires_at: string;
};

type Options = { accessSecret: string; accessTtlSeconds: number; refreshTtlDays: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: AuditRepository,
    private readonly options: Options,
  ) {}

  async register(input: { email: string; password: string; displayName: string | null }, requestId: string) {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await this.users.createWithPassword({ email: input.email, displayName: input.displayName, passwordHash });
    await this.audit.record({ requestId, actorType: "USER", actorId: user.id, eventType: "auth.register", entityType: "user", entityId: user.id, outcome: "SUCCESS" });
    return { user, tokens: await this.issueTokens(user, randomUUID()) };
  }

  async login(email: string, password: string, requestId: string) {
    const found = await this.users.findCredentialsByEmail(email);
    const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
    if (!found || !valid || found.user.status !== "ACTIVE") {
      await this.audit.record({ requestId, actorType: "USER", actorId: found?.user.id ?? null, eventType: "auth.login", outcome: "FAILURE" });
      throw unauthorized("INVALID_CREDENTIALS", "The email or password is incorrect.");
    }
    await this.audit.record({ requestId, actorType: "USER", actorId: found.user.id, eventType: "auth.login", outcome: "SUCCESS" });
    return { user: found.user, tokens: await this.issueTokens(found.user, randomUUID()) };
  }

  async refresh(refreshToken: string, requestId: string): Promise<TokenPair> {
    const record = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (!record) throw unauthorized("REFRESH_TOKEN_INVALID", "The refresh token is invalid.");
    if (record.revokedAt) {
      // A rotated token was presented again: assume theft and end every session in the family.
      await this.refreshTokens.revokeFamily(record.familyId);
      await this.audit.record({ requestId, actorType: "USER", actorId: record.userId, eventType: "auth.refresh_reuse", outcome: "REVOKED_FAMILY" });
      throw unauthorized("REFRESH_TOKEN_REUSED", "The refresh token was already used. Please sign in again.");
    }
    if (record.expiresAt.getTime() <= Date.now()) throw unauthorized("REFRESH_TOKEN_EXPIRED", "The refresh token has expired.");

    const user = await this.users.findById(record.userId);
    if (!user || user.status !== "ACTIVE") {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw unauthorized("REFRESH_TOKEN_INVALID", "The refresh token is invalid.");
    }

    const next = this.newRefreshToken();
    const rotated = await this.refreshTokens.rotate(record.id, {
      userId: user.id,
      familyId: record.familyId,
      tokenHash: hashToken(next.token),
      expiresAt: next.expiresAt,
    });
    if (!rotated) {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw unauthorized("REFRESH_TOKEN_REUSED", "The refresh token was already used. Please sign in again.");
    }
    return this.pair(user, next.token, next.expiresAt);
  }

  async logout(refreshToken: string, requestId: string): Promise<void> {
    const record = await this.refreshTokens.findByHash(hashToken(refreshToken));
    if (!record) return;
    await this.refreshTokens.revokeFamily(record.familyId);
    await this.audit.record({ requestId, actorType: "USER", actorId: record.userId, eventType: "auth.logout", outcome: "SUCCESS" });
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const claims = jwt.verify(token, this.options.accessSecret, {
        algorithms: ["HS256"],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      }) as jwt.JwtPayload;
      if (typeof claims.sub !== "string" || !ROLES.includes(claims.role as Role)) throw new Error("bad claims");
      return { userId: claims.sub, role: claims.role as Role };
    } catch {
      throw unauthorized("ACCESS_TOKEN_INVALID", "The access token is missing, invalid or expired.");
    }
  }

  private newRefreshToken() {
    return {
      token: randomBytes(32).toString("base64url"),
      expiresAt: new Date(Date.now() + this.options.refreshTtlDays * 86_400_000),
    };
  }

  private async issueTokens(user: User, familyId: string): Promise<TokenPair> {
    const next = this.newRefreshToken();
    await this.refreshTokens.create({ userId: user.id, familyId, tokenHash: hashToken(next.token), expiresAt: next.expiresAt });
    return this.pair(user, next.token, next.expiresAt);
  }

  private pair(user: User, refreshToken: string, refreshExpiresAt: Date): TokenPair {
    const accessToken = jwt.sign({ role: user.role }, this.options.accessSecret, {
      algorithm: "HS256",
      subject: user.id,
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: this.options.accessTtlSeconds,
    });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: this.options.accessTtlSeconds,
      refresh_token: refreshToken,
      refresh_expires_at: refreshExpiresAt.toISOString(),
    };
  }
}
