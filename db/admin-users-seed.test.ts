import assert from "node:assert/strict";
import test from "node:test";
import type { SQL } from "drizzle-orm";
import { verifyPassword } from "../lib/password-hash";
import { applyAdminUsersSeed, planAdminUsersSeed, type SqlExecutor } from "./admin-users-seed";

const FIXTURE_PASSWORD = "fixture-password";
const OTHER_PASSWORD = "other-fixture-pw";

function seedJson(
  users: { username: string; displayName: string; role: "owner" | "admin"; password: string }[],
) {
  return JSON.stringify(users);
}

function parts(query: SQL): { text: string; params: unknown[] } {
  const chunks = (query as unknown as { queryChunks?: unknown[] }).queryChunks ?? [];
  const params: unknown[] = [];
  let text = "";
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && "value" in chunk && Array.isArray((chunk as { value: unknown }).value)) {
      const value = (chunk as { value: unknown[] }).value;
      if (value.every((item) => typeof item === "string")) {
        text += value.join("");
        continue;
      }
    }
    params.push(chunk);
  }
  return { text, params };
}

function recordingDb(existing: { email: string }[] = []): SqlExecutor & { queries: SQL[] } {
  const queries: SQL[] = [];
  return {
    queries,
    execute: async (query: SQL) => {
      queries.push(query);
      return { rows: existing };
    },
  };
}

test("missing or empty ADMIN_USERS_SEED is a no-op and does not hash or query", async () => {
  const hashPassword = async () => {
    throw new Error("should not hash");
  };
  const database: SqlExecutor = {
    execute: async () => {
      throw new Error("should not query");
    },
  };
  for (const raw of [undefined, null, "", "   ", "[]"]) {
    const plan = await planAdminUsersSeed({ raw, existingUsernames: ["itay"], hashPassword });
    assert.deepEqual(plan, { inserted: [], skipped: 0, log: "Admin users seed: 0 inserted, 0 skipped" });
    const applied = await applyAdminUsersSeed(database, { raw, hashPassword });
    assert.deepEqual(applied, plan);
  }
});

test("an existing username is skipped and a new one is inserted with a hashed password", async () => {
  const raw = seedJson([
    { username: " Itay ", displayName: " איתי פנסו ", role: "owner", password: FIXTURE_PASSWORD },
    { username: "omer", displayName: "עומר בן", role: "admin", password: OTHER_PASSWORD },
  ]);
  const plan = await planAdminUsersSeed({ raw, existingUsernames: ["ITAY"] });

  assert.equal(plan.skipped, 1);
  assert.equal(plan.inserted.length, 1);
  assert.equal(plan.log, "Admin users seed: 1 inserted, 1 skipped");
  const row = plan.inserted[0];
  assert.equal(row.email, "omer");
  assert.equal(row.displayName, "עומר בן");
  assert.equal(row.role, "admin");
  assert.equal(row.mustChangePassword, false);
  assert.match(row.passwordHash, /^scrypt\$[^$]+\$[^$]+$/);
  assert.equal(row.passwordHash.includes(OTHER_PASSWORD), false);
  assert.equal(await verifyPassword(OTHER_PASSWORD, row.passwordHash), true);
  assert.equal(await verifyPassword(FIXTURE_PASSWORD, row.passwordHash), false);

  const dumped = JSON.stringify(plan);
  assert.equal(dumped.includes(FIXTURE_PASSWORD), false);
  assert.equal(dumped.includes(OTHER_PASSWORD), false);
  assert.equal(dumped.includes(raw), false);
});

test("seed logs are counts only and never include plaintext or the raw JSON", async () => {
  const raw = seedJson([
    { username: "raz", displayName: "רז וייסבלך", role: "admin", password: FIXTURE_PASSWORD },
    { username: "yoni", displayName: "יוני מרק", role: "admin", password: OTHER_PASSWORD },
  ]);
  const plan = await planAdminUsersSeed({
    raw,
    existingUsernames: [],
    hashPassword: async (password) => `hashed:${password}`,
  });

  assert.equal(plan.log, "Admin users seed: 2 inserted, 0 skipped");
  assert.equal(plan.log.includes(FIXTURE_PASSWORD), false);
  assert.equal(plan.log.includes(OTHER_PASSWORD), false);
  assert.equal(plan.log.includes("hashed:"), false);
  assert.equal(plan.log.includes(raw), false);
  assert.deepEqual(
    plan.inserted.map((row) => row.passwordHash),
    [`hashed:${FIXTURE_PASSWORD}`, `hashed:${OTHER_PASSWORD}`],
  );
  assert.equal(JSON.stringify(plan.log).includes(FIXTURE_PASSWORD), false);
});

test("apply inserts only new usernames, leaves existing rows alone, and does not log secrets", async () => {
  const raw = seedJson([
    { username: "itay", displayName: "איתי פנסו", role: "owner", password: FIXTURE_PASSWORD },
    { username: "idan", displayName: "עידן קרן", role: "admin", password: OTHER_PASSWORD },
  ]);
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    const database = recordingDb([{ email: "itay" }]);
    const plan = await applyAdminUsersSeed(database, {
      raw,
      hashPassword: async (password) => `hashed:${password}`,
    });
    console.log(plan.log);

    assert.equal(plan.log, "Admin users seed: 1 inserted, 1 skipped");
    assert.equal(logs.join("\n"), plan.log);
    assert.equal(logs.join("\n").includes(FIXTURE_PASSWORD), false);
    assert.equal(logs.join("\n").includes(OTHER_PASSWORD), false);
    assert.equal(logs.join("\n").includes(raw), false);

    assert.equal(database.queries.length, 2);
    const select = parts(database.queries[0]);
    const insert = parts(database.queries[1]);
    assert.match(select.text, /SELECT email FROM admin_users/);
    assert.equal(select.params.length, 0);
    assert.match(insert.text, /INSERT INTO admin_users/);
    assert.match(insert.text, /must_change_password/);
    assert.match(insert.text, /true,\s*false,/);
    assert.match(insert.text, /WHERE NOT EXISTS/);
    assert.doesNotMatch(insert.text, /\bUPDATE\b/i);
    assert.equal(insert.params.includes(FIXTURE_PASSWORD), false);
    assert.equal(insert.params.includes(OTHER_PASSWORD), false);
    assert.equal(insert.params.includes(`hashed:${OTHER_PASSWORD}`), true);
    assert.equal(insert.params.includes("idan"), true);
    assert.equal(insert.params.includes("עידן קרן"), true);
    assert.equal(insert.params.includes("admin"), true);
    const blob = JSON.stringify(database.queries);
    assert.equal(blob.includes(FIXTURE_PASSWORD), false);
    assert.equal(blob.includes(OTHER_PASSWORD) && !blob.includes(`hashed:${OTHER_PASSWORD}`), false);
    assert.equal(blob.includes("games"), false);
    assert.equal(blob.includes("slots"), false);
    assert.equal(blob.includes("practice"), false);
  } finally {
    console.log = original;
  }
});

test("a second apply skips usernames already present and does not send their passwords", async () => {
  const raw = seedJson([{ username: "tomer", displayName: "תומר", role: "admin", password: FIXTURE_PASSWORD }]);
  const database = recordingDb([{ email: "Tomer" }]);
  const plan = await applyAdminUsersSeed(database, {
    raw,
    hashPassword: async () => {
      throw new Error("should not hash an existing user");
    },
  });
  assert.equal(plan.log, "Admin users seed: 0 inserted, 1 skipped");
  assert.equal(database.queries.length, 1);
  assert.match(parts(database.queries[0]).text, /SELECT email FROM admin_users/);
  assert.equal(JSON.stringify(database.queries).includes(FIXTURE_PASSWORD), false);
});

test("invalid seed JSON fails without echoing the payload", async () => {
  const raw = `{"password":"${FIXTURE_PASSWORD}"}`;
  await assert.rejects(
    () => planAdminUsersSeed({ raw, existingUsernames: [] }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "ADMIN_USERS_SEED must be a JSON array");
      assert.equal(err.message.includes(FIXTURE_PASSWORD), false);
      assert.equal(err.message.includes(raw), false);
      return true;
    },
  );

  const broken = `not-json ${FIXTURE_PASSWORD}`;
  await assert.rejects(
    () => planAdminUsersSeed({ raw: broken, existingUsernames: [] }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "ADMIN_USERS_SEED is not valid JSON");
      assert.equal(err.message.includes(FIXTURE_PASSWORD), false);
      assert.equal(err.message.includes(broken), false);
      return true;
    },
  );
});

test("invalid usernames, roles, and short passwords are rejected without the secret", async () => {
  const cases = [
    { username: "bad name", displayName: "שם", role: "admin", password: FIXTURE_PASSWORD },
    { username: "ok.user", displayName: "שם", role: "coach", password: FIXTURE_PASSWORD },
    { username: "ok.user", displayName: "שם", role: "admin", password: "1234567" },
    { username: "ok.user", displayName: "   ", role: "owner", password: FIXTURE_PASSWORD },
  ];
  for (const entry of cases) {
    const raw = seedJson([entry as { username: string; displayName: string; role: "admin"; password: string }]);
    await assert.rejects(
      () => planAdminUsersSeed({ raw, existingUsernames: [] }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /^ADMIN_USERS_SEED entry 1 /);
        assert.equal(err.message.includes(FIXTURE_PASSWORD), false);
        assert.equal(err.message.includes("1234567"), false);
        assert.equal(err.message.includes(raw), false);
        return true;
      },
    );
  }
});

test("the migration data step logs only the count line", async () => {
  const previous = process.env.ADMIN_USERS_SEED;
  const raw = seedJson([{ username: "raz", displayName: "רז וייסבלך", role: "admin", password: FIXTURE_PASSWORD }]);
  process.env.ADMIN_USERS_SEED = raw;
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    const { apply } = await import("../netlify/database/migrations/20261112130000_seed_admin_users/data");
    const database = recordingDb();
    await apply(database);
    assert.deepEqual(logs, ["Admin users seed: 1 inserted, 0 skipped"]);
    assert.equal(logs.join("\n").includes(FIXTURE_PASSWORD), false);
    assert.equal(logs.join("\n").includes(raw), false);
    const insert = parts(database.queries[1]);
    assert.equal(insert.params.includes(FIXTURE_PASSWORD), false);
    assert.equal(
      insert.params.some((param) => typeof param === "string" && param.startsWith("scrypt$")),
      true,
    );
    assert.equal(insert.params.includes("raz"), true);
    assert.equal(insert.params.filter((param) => param === false).length, 0);
  } finally {
    console.log = original;
    if (previous === undefined) delete process.env.ADMIN_USERS_SEED;
    else process.env.ADMIN_USERS_SEED = previous;
  }
});
