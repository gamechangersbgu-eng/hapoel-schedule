import { drizzle } from "drizzle-orm/netlify-db";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function netlifyDb() {
  return drizzle({ schema });
}

// LOCAL_DATABASE_URL is set only by scripts/seed-local.mjs, to run the seed against the
// local Postgres that `npm run dev:local` starts. Everywhere else (the site, Netlify) the
// Netlify driver is used as before. Both drivers expose the same query API.
const localUrl = process.env.LOCAL_DATABASE_URL;

export const db: ReturnType<typeof netlifyDb> = localUrl
  ? (drizzleNodePg(localUrl, { schema }) as unknown as ReturnType<typeof netlifyDb>)
  : netlifyDb();
