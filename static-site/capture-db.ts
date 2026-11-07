// Fake "db" used ONLY to run db/seed.ts without a database and capture what it inserts.
import { cities, pitches, settings, slots, teams } from "../db/schema";

export const captured: {
  settings: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  slots: Record<string, unknown>[];
} = { settings: [], teams: [], slots: [] };

let nextTeamId = 1;
let nextSlotId = 1;
let nextRowId = 1;

const tableStore = new Map<unknown, Record<string, unknown>[]>();

function bucketFor(table: unknown) {
  if (table === settings) return captured.settings;
  if (table === teams) return captured.teams;
  if (table === slots) return captured.slots;
  if (!tableStore.has(table)) tableStore.set(table, []);
  return tableStore.get(table)!;
}

function assignIds(table: unknown, copy: Record<string, unknown>) {
  if (table === teams) copy.id = nextTeamId++;
  else if (table === slots) copy.id = nextSlotId++;
  else if (table === pitches || table === cities) {
    if (copy.id == null) copy.id = nextRowId++;
  } else if (copy.id == null && table !== settings) {
    copy.id = nextRowId++;
  }
}

export const db = {
  delete: async () => undefined,
  select(_fields?: unknown) {
    return {
      from(t: unknown) {
        const read = () => [...bucketFor(t)];
        const query = Promise.resolve(read()) as Promise<Record<string, unknown>[]> & {
          limit: (n: number) => Promise<Record<string, unknown>[]>;
        };
        query.limit = (n: number) => Promise.resolve(read().slice(0, n));
        return query;
      },
    };
  },
  insert(table: unknown) {
    return {
      values(input: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = (Array.isArray(input) ? input : [input]).map((row) => {
          const copy = { ...row };
          assignIds(table, copy);
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
