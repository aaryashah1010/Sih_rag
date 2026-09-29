import type { Request, Response } from "express";
import { notFound } from "../../domain/errors.js";
import type { MessageRepository, SessionRepository } from "../../ports/repositories.js";
import { authContext } from "../middleware/authenticate.js";
import { presentMessage, presentSession } from "../presenters.js";
import { createSessionBody, pageQuery, updateSessionBody, uuidParam } from "../schemas.js";

const sessionPage = pageQuery(50, 20);
const messagePage = pageQuery(100, 50);

export function sessionController(sessions: SessionRepository, messages: MessageRepository) {
  // Ownership is enforced by querying with the caller's user ID; another user's session reads as 404.
  async function ownedSession(request: Request, response: Response) {
    const id = uuidParam.safeParse(request.params.sessionId);
    const session = id.success ? await sessions.findForUser(id.data, authContext(response).userId) : null;
    if (!session) throw notFound("The session does not exist.");
    return session;
  }

  return {
    async create(request: Request, response: Response) {
      const body = createSessionBody.parse(request.body ?? {});
      const session = await sessions.create({
        userId: authContext(response).userId,
        title: body.title ?? null,
        jurisdiction: body.jurisdiction,
        language: body.language,
      });
      response.status(201).json(presentSession(session));
    },

    async list(request: Request, response: Response) {
      const query = sessionPage.parse(request.query);
      const result = await sessions.listForUser(authContext(response).userId, query.cursor ?? null, query.limit);
      response.json({ items: result.items.map(presentSession), next_cursor: result.nextCursor });
    },

    async get(request: Request, response: Response) {
      response.json(presentSession(await ownedSession(request, response)));
    },

    async update(request: Request, response: Response) {
      const session = await ownedSession(request, response);
      const body = updateSessionBody.parse(request.body);
      response.json(presentSession(await sessions.update(session.id, body)));
    },

    async remove(request: Request, response: Response) {
      const session = await ownedSession(request, response);
      await sessions.softDelete(session.id);
      response.status(204).end();
    },

    async listMessages(request: Request, response: Response) {
      const session = await ownedSession(request, response);
      const query = messagePage.parse(request.query);
      const result = await messages.listForSession(session.id, query.cursor ?? null, query.limit);
      response.json({ items: result.items.map(presentMessage), next_cursor: result.nextCursor });
    },
  };
}
