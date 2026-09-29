import type { Knex } from "knex";
import { AppError, conflict } from "../../domain/errors.js";
import type { ChatSession, Message, Page, User } from "../../domain/types.js";
import type {
  AuditEvent,
  RefreshTokenRecord,
  Repositories,
  StoredAnswer,
} from "../../ports/repositories.js";
import type { RagQueryResponse } from "../../ports/rag-client.js";
import { decodeCursor, encodeCursor, UTC_MICROS } from "./cursor.js";

type Row = Record<string, any>;

const USER_COLUMNS = ["id", "email", "display_name", "preferred_language", "role", "status", "created_at"];

const toUser = (row: Row): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  preferredLanguage: row.preferred_language,
  role: row.role,
  status: row.status,
  createdAt: row.created_at,
});

const toSession = (row: Row): ChatSession => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  jurisdiction: row.jurisdiction_code,
  language: row.language,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row: Row): Message => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  language: row.language,
  clientMessageId: row.client_message_id,
  createdAt: row.created_at,
});

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === "23505";

function page<T>(rows: Row[], limit: number, map: (row: Row) => T): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(map),
    nextCursor: rows.length > limit && last ? encodeCursor({ ts: last.cursor_ts, id: last.id }) : null,
  };
}

export function createPostgresRepositories(db: Knex): Repositories {
  return {
    async ping() {
      try {
        await db.raw("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },

    users: {
      async createWithPassword({ email, displayName, passwordHash }) {
        try {
          return await db.transaction(async (trx) => {
            const [row] = await trx("app.users")
              .insert({ email, display_name: displayName })
              .returning(USER_COLUMNS);
            await trx("app.user_credentials").insert({ user_id: row.id, password_hash: passwordHash });
            return toUser(row);
          });
        } catch (error) {
          if (isUniqueViolation(error)) throw conflict("EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
          throw error;
        }
      },

      async findCredentialsByEmail(email) {
        const row = await db("app.users as u")
          .join("app.user_credentials as c", "c.user_id", "u.id")
          .whereRaw("lower(u.email) = lower(?)", [email])
          .whereNot("u.status", "DELETED")
          .first(...USER_COLUMNS.map((column) => `u.${column}`), "c.password_hash");
        return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
      },

      async findById(id) {
        const row = await db("app.users").where({ id }).first(USER_COLUMNS);
        return row ? toUser(row) : null;
      },

      async updateProfile(id, patch) {
        const changes: Row = {};
        if (patch.displayName !== undefined) changes.display_name = patch.displayName;
        if (patch.preferredLanguage !== undefined) changes.preferred_language = patch.preferredLanguage;
        const query = db("app.users").where({ id });
        const [row] = Object.keys(changes).length
          ? await query.update(changes).returning(USER_COLUMNS)
          : await query.select(USER_COLUMNS);
        return toUser(row);
      },
    },

    refreshTokens: {
      async create({ userId, familyId, tokenHash, expiresAt }) {
        const [row] = await db("app.refresh_tokens")
          .insert({ user_id: userId, family_id: familyId, token_hash: tokenHash, expires_at: expiresAt })
          .returning("id");
        return row.id;
      },

      async findByHash(tokenHash) {
        const row = await db("app.refresh_tokens").where({ token_hash: tokenHash }).first();
        return row
          ? ({ id: row.id, userId: row.user_id, familyId: row.family_id, expiresAt: row.expires_at, revokedAt: row.revoked_at } satisfies RefreshTokenRecord)
          : null;
      },

      async rotate(oldId, next) {
        return db.transaction(async (trx) => {
          // The conditional update takes the row lock, so two concurrent refreshes cannot both win.
          const revoked = await trx("app.refresh_tokens")
            .where({ id: oldId })
            .whereNull("revoked_at")
            .update({ revoked_at: db.fn.now() });
          if (revoked !== 1) return false;
          const [inserted] = await trx("app.refresh_tokens")
            .insert({ user_id: next.userId, family_id: next.familyId, token_hash: next.tokenHash, expires_at: next.expiresAt })
            .returning("id");
          await trx("app.refresh_tokens").where({ id: oldId }).update({ replaced_by_id: inserted.id });
          return true;
        });
      },

      async revokeFamily(familyId) {
        await db("app.refresh_tokens").where({ family_id: familyId }).whereNull("revoked_at").update({ revoked_at: db.fn.now() });
      },
    },

    sessions: {
      async create({ userId, title, jurisdiction, language }) {
        const [row] = await db("app.sessions")
          .insert({ user_id: userId, title, jurisdiction_code: jurisdiction, language })
          .returning("*");
        return toSession(row);
      },

      async listForUser(userId, cursor, limit) {
        const key = decodeCursor(cursor);
        const query = db("app.sessions")
          .select("*", db.raw(`to_char(updated_at AT TIME ZONE 'UTC', ${UTC_MICROS}) AS cursor_ts`))
          .where({ user_id: userId })
          .whereNot("status", "DELETED")
          .orderBy([{ column: "updated_at", order: "desc" }, { column: "id", order: "desc" }])
          .limit(limit + 1);
        if (key) query.whereRaw("(updated_at, id) < (?::timestamptz, ?::uuid)", [key.ts, key.id]);
        return page(await query, limit, toSession);
      },

      async findForUser(id, userId) {
        const row = await db("app.sessions").where({ id, user_id: userId }).whereNot("status", "DELETED").first();
        return row ? toSession(row) : null;
      },

      async update(id, patch) {
        const changes: Row = {};
        if (patch.title !== undefined) changes.title = patch.title;
        if (patch.jurisdiction !== undefined) changes.jurisdiction_code = patch.jurisdiction;
        if (patch.language !== undefined) changes.language = patch.language;
        if (patch.status !== undefined) changes.status = patch.status;
        const query = db("app.sessions").where({ id });
        const [row] = Object.keys(changes).length ? await query.update(changes).returning("*") : await query.select("*");
        return toSession(row);
      },

      async softDelete(id) {
        await db("app.sessions").where({ id }).update({ status: "DELETED" });
      },

      async touch(id) {
        await db("app.sessions").where({ id }).update({ updated_at: db.fn.now() });
      },
    },

    messages: {
      async listForSession(sessionId, cursor, limit) {
        const key = decodeCursor(cursor);
        const query = db("app.messages")
          .select("*", db.raw(`to_char(created_at AT TIME ZONE 'UTC', ${UTC_MICROS}) AS cursor_ts`))
          .where({ session_id: sessionId })
          .orderBy([{ column: "created_at", order: "asc" }, { column: "id", order: "asc" }])
          .limit(limit + 1);
        if (key) query.whereRaw("(created_at, id) > (?::timestamptz, ?::uuid)", [key.ts, key.id]);
        return page(await query, limit, toMessage);
      },

      async insertUserMessage({ sessionId, content, language, clientMessageId }) {
        const inserted = await db("app.messages")
          .insert({ session_id: sessionId, role: "USER", content, language, client_message_id: clientMessageId })
          .onConflict(["session_id", "client_message_id"])
          .ignore()
          .returning("*");
        if (inserted.length) return { message: toMessage(inserted[0]), created: true };
        const existing = await db("app.messages").where({ session_id: sessionId, client_message_id: clientMessageId }).first();
        return { message: toMessage(existing), created: false };
      },

      async findAnswerForUserMessage(userMessageId) {
        const answer = await db("app.answers").where({ user_message_id: userMessageId }).first();
        return answer ? loadStoredAnswer(db, answer) : null;
      },

      async saveAnswer({ sessionId, userMessageId, language, rag }) {
        return db.transaction(async (trx) => {
          const existing = await trx("app.answers").where({ user_message_id: userMessageId }).forUpdate().first();
          if (existing) return loadStoredAnswer(trx, existing);

          const [assistant] = await trx("app.messages")
            .insert({ session_id: sessionId, role: "ASSISTANT", content: rag.answer || "(no answer text)", language })
            .returning("id");
          const [answer] = await trx("app.answers")
            .insert({
              user_message_id: userMessageId,
              assistant_message_id: assistant.id,
              retrieval_run_id: rag.retrieval_run_id,
              corpus_version_id: rag.corpus_version_id,
              model_name: rag.model.name,
              model_version: rag.model.version ?? null,
              policy_version: rag.policy_version,
              decision: rag.decision,
              confidence: rag.confidence ?? null,
              answer_text: rag.answer,
              missing_information: JSON.stringify(rag.missing_information),
            })
            .returning("*");
          await insertClaimsAndCitations(trx, answer.id, rag);
          return loadStoredAnswer(trx, answer);
        }).catch((error: unknown) => {
          if (isUniqueViolation(error)) {
            // A concurrent retry stored the answer first; return that one.
            return db("app.answers").where({ user_message_id: userMessageId }).first().then((row) => loadStoredAnswer(db, row));
          }
          throw error;
        });
      },
    },

    audit: {
      async record(event: AuditEvent) {
        await db("audit.events").insert({
          request_id: isUuid(event.requestId) ? event.requestId : null,
          actor_type: event.actorType,
          actor_id: event.actorId ?? null,
          event_type: event.eventType,
          entity_type: event.entityType ?? null,
          entity_id: event.entityId ?? null,
          outcome: event.outcome ?? null,
          event_data: JSON.stringify(event.data ?? {}),
        });
      },
    },
  };

}

const isUuid = (value: string | undefined): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function insertClaimsAndCitations(trx: Knex.Transaction, answerId: string, rag: RagQueryResponse): Promise<void> {
  const claimIdByLabel = new Map<string, string>();
  for (const claim of rag.claims) {
    const [row] = await trx("app.answer_claims")
      .insert({
        answer_id: answerId,
        claim_index: claim.claim_index,
        claim_text: claim.claim_text,
        support_status: claim.support_status,
        verifier_score: claim.verifier_score ?? null,
      })
      .returning("id");
    for (const label of claim.citation_labels) {
      if (!claimIdByLabel.has(label)) claimIdByLabel.set(label, row.id);
    }
  }
  if (!rag.citations.length) return;
  await trx("app.citations").insert(
    rag.citations.map((citation) => ({
      answer_id: answerId,
      claim_id: claimIdByLabel.get(citation.label) ?? null,
      chunk_id: citation.chunk_id,
      citation_label: citation.label,
      authority_snapshot: citation.authority,
      document_title_snapshot: citation.document_title,
      locator_snapshot: citation.locator ?? null,
      quoted_span: citation.quoted_span ?? null,
      source_url_snapshot: citation.source_url ?? null,
      page_start: citation.page_start ?? null,
      page_end: citation.page_end ?? null,
    })),
  );
}

async function loadStoredAnswer(db: Knex | Knex.Transaction, answer: Row): Promise<StoredAnswer> {
  if (!answer) throw new AppError(500, "ANSWER_MISSING", "Internal Server Error", "The stored answer could not be loaded.");
  const citations = await db("app.citations").where({ answer_id: answer.id }).orderBy("citation_label");
  return {
    answerId: answer.id,
    assistantMessageId: answer.assistant_message_id,
    decision: answer.decision,
    answer: answer.answer_text,
    confidence: answer.confidence === null ? null : Number(answer.confidence),
    missingInformation: answer.missing_information,
    citations: citations.map((row: Row) => ({
      label: row.citation_label,
      authority: row.authority_snapshot,
      document: row.document_title_snapshot,
      locator: row.locator_snapshot,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      sourceUrl: row.source_url_snapshot,
    })),
  };
}
