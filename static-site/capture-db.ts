// Fake "db" used ONLY to run db/seed.ts without a database and capture what it inserts.
import { settings, slots, teams } from "../db/schema";

export const captured: {
  settings: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  slots: Record<string, unknown>[];
} = { settings: [], teams: [], slots: [] };

let nextTeamId = 1;
let nextSlotId = 1;

function bucketFor(table: unknown) {
  if (table === settings) return captured.settings;
  if (table === teams) return captured.teams;
  if (table === slots) return captured.slots;
  throw new Error("Unknown table");
}

export const db = {
  delete: async () => undefined,
  insert(table: unknown) {
    return {
      values(input: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = (Array.isArray(input) ? input : [input]).map((row) => {
          const copy = { ...row };
          if (table === teams) copy.id = nextTeamId++;
          if (table === slots) copy.id = nextSlotId++;
          bucketFor(table).push(copy);
          return copy;
        });
        const promise = Promise.resolve(undefined) as Promise<undefined> & {
          returning: () => Promise<Record<string, unknown>[]>;
        };
        promise.returning = async () => rows;
        return promise;
      },
    };
  },
};
