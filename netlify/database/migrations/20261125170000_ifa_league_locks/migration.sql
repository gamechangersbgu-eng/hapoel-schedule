-- Lock four youth squads onto the league the club uses, and move games already imported
-- onto the other squad in the same age group. Targeted updates only: no deletes, no re-seed.
-- Coach labels are what production stores. Short names are the original calendar rows.
-- A later IFA import reads ifa_team_locks and will not move these games again.

CREATE TABLE IF NOT EXISTS "ifa_team_locks" (
  "ifa_team_id" integer PRIMARY KEY,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "league_label" text NOT NULL,
  "locked" boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
INSERT INTO "ifa_team_locks" ("ifa_team_id", "team_id", "league_label", "locked")
SELECT DISTINCT ON (v.ifa_team_id)
  v.ifa_team_id,
  t."id",
  v.league_label,
  true
FROM (
  VALUES
    (6248::integer, 'ליגת ילדים ב'' מרכז'::text, 'ילדים ב נועם'::text, 'ילדים ב'::text),
    (2755::integer, 'ליגת ילדים ב'' דן'::text, 'ילדים ב חגי'::text, 'ילדים ב ל'::text),
    (2014::integer, 'ליגת ילדים ג'' מרכז'::text, 'ילדים ג ניצן'::text, 'ילדים ג'::text),
    (2143::integer, 'ליגת ילדים ג'' דן'::text, 'ילדים ג סטיב'::text, 'ילדים ג ל'::text)
) AS v(ifa_team_id, league_label, coach_name, short_name)
JOIN "teams" t ON t."name" = v.coach_name OR t."name" = v.short_name
ORDER BY v.ifa_team_id, CASE WHEN t."name" = v.coach_name THEN 0 ELSE 1 END, t."id"
ON CONFLICT ("ifa_team_id") DO UPDATE
SET "team_id" = EXCLUDED."team_id",
    "league_label" = EXCLUDED."league_label",
    "locked" = true;
--> statement-breakpoint
WITH moved AS (
  UPDATE "slots" AS s
  SET "team_id" = l."team_id"
  FROM "slot_game_details" AS d
  JOIN "ifa_team_locks" AS l
    ON l."locked" = true
   AND split_part(d."external_id", ':', 2) = l."ifa_team_id"::text
  WHERE d."slot_id" = s."id"
    AND d."source" = 'ifa_scraper'
    AND s."team_id" IS DISTINCT FROM l."team_id"
  RETURNING s."id"
)
UPDATE "schedule_revision"
SET "version" = "version" + 1,
    "updated_at" = to_char(timezone('utc', clock_timestamp()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE "id" = 1
  AND EXISTS (SELECT 1 FROM moved);
