import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_SQLITE_PATH = join(process.cwd(), "data", "local.db");

/** Minimal mirror of schedule write tables for offline/manual edits. */
export function openLocalSqliteBuffer() {
  mkdirSync(dirname(LOCAL_SQLITE_PATH), { recursive: true });
  const db = new DatabaseSync(LOCAL_SQLITE_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      end_date TEXT,
      start_time TEXT,
      type TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS slot_game_details (
      slot_id INTEGER PRIMARY KEY,
      game_kind TEXT NOT NULL,
      opponent TEXT,
      kickoff_time TEXT,
      source TEXT,
      external_id TEXT,
      UNIQUE(source, external_id)
    );
  `);
  return db;
}

export type LocalSlotRow = {
  id: number;
  team_id: number;
  date: string;
  end_date: string | null;
  start_time: string | null;
  type: string;
  note: string | null;
};

export type LocalGameDetailRow = {
  slot_id: number;
  game_kind: string;
  opponent: string | null;
  kickoff_time: string | null;
  source: string | null;
  external_id: string | null;
};
