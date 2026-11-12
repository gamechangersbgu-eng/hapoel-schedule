import { applyAdminUsersSeed, type SqlExecutor } from "../../../../db/admin-users-seed";

/** Invoked by db/apply-migrations.ts. Logs counts only — never the seed JSON or passwords. */
export async function apply(database: SqlExecutor) {
  const result = await applyAdminUsersSeed(database);
  console.log(result.log);
}
