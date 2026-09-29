import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import knex, { type Knex } from "knex";

// Forward-only SQL migrations for the app schema. Knex provides locking and bookkeeping;
// the files themselves are plain reviewed SQL.
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

const sqlMigrationSource: Knex.MigrationSource<string> = {
  async getMigrations() {
    return (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  },
  getMigrationName(migration) {
    return migration;
  },
  async getMigration(migration) {
    const sql = await readFile(path.join(migrationsDir, migration), "utf8");
    return {
      up: (db: Knex) => db.raw(sql),
      down: () => {
        throw new Error("app migrations are forward-only; write a new migration to reverse a change");
      },
    };
  },
};

async function main(): Promise<void> {
  const connection = process.env.NODE_MIGRATION_DATABASE_URL;
  if (!connection) throw new Error("NODE_MIGRATION_DATABASE_URL is required to run app migrations");

  const db = knex({ client: "pg", connection });
  try {
    const [batch, applied] = await db.migrate.latest({
      migrationSource: sqlMigrationSource,
      schemaName: "migrations",
      tableName: "app_knex_migrations",
    });
    console.log(applied.length ? `Applied batch ${batch}: ${applied.join(", ")}` : "App schema is up to date");
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("App migration failed", error);
  process.exitCode = 1;
});
