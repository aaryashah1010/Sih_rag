import type { Request, Response } from "express";
import type { AuthService } from "../../application/auth.service.js";
import { notFound } from "../../domain/errors.js";
import type { UserRepository } from "../../ports/repositories.js";
import { authContext, requestId } from "../middleware/authenticate.js";
import { presentUser } from "../presenters.js";
import { loginBody, refreshBody, registerBody, updateMeBody } from "../schemas.js";

export function authController(auth: AuthService, users: UserRepository) {
  return {
    async register(request: Request, response: Response) {
      const body = registerBody.parse(request.body);
      const { user, tokens } = await auth.register(
        { email: body.email, password: body.password, displayName: body.display_name ?? null },
        requestId(request),
      );
      response.status(201).json({ user: presentUser(user), ...tokens });
    },

    async login(request: Request, response: Response) {
      const body = loginBody.parse(request.body);
      const { user, tokens } = await auth.login(body.email, body.password, requestId(request));
      response.json({ user: presentUser(user), ...tokens });
    },

    async refresh(request: Request, response: Response) {
      const body = refreshBody.parse(request.body);
      response.json(await auth.refresh(body.refresh_token, requestId(request)));
    },

    async logout(request: Request, response: Response) {
      const body = refreshBody.parse(request.body);
      await auth.logout(body.refresh_token, requestId(request));
      response.status(204).end();
    },

    async me(_request: Request, response: Response) {
      const user = await users.findById(authContext(response).userId);
      if (!user || user.status !== "ACTIVE") throw notFound("The user does not exist.");
      response.json(presentUser(user));
    },

    async updateMe(request: Request, response: Response) {
      const body = updateMeBody.parse(request.body);
      const user = await users.updateProfile(authContext(response).userId, {
        displayName: body.display_name,
        preferredLanguage: body.preferred_language,
      });
      response.json(presentUser(user));
    },
  };
}
