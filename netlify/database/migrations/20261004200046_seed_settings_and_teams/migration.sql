INSERT INTO "settings" ("id", "club_name", "season_start_date")
VALUES (1, 'הפועל באר שבע', '2026-06-28')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "teams" ("name", "sort_order", "is_comments") VALUES
  ('נוער', 0, false),
  ('נערים א', 1, false),
  ('נערים ב', 2, false),
  ('נערים ג', 3, false),
  ('ילדים א', 4, false),
  ('ילדים ב', 5, false),
  ('ילדים ב ל', 6, false),
  ('ילדים ג', 7, false),
  ('ילדים ג ל', 8, false),
  ('טרום א', 9, false),
  ('טרום א ל', 10, false),
  ('טרום ב', 11, false),
  ('טרום ב ל', 12, false),
  ('טרום ג', 13, false),
  ('בית ספר', 14, false),
  ('מ.קייץ', 15, false),
  ('הערות', 16, true);
