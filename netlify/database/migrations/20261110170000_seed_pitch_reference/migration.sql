-- Idempotent reference data for the pitch board (לוח שיבוץ מגרשים).
-- Until now these rows were created only by db/seed.ts (local development), so on the Netlify
-- database the "pitches" table was empty and the board showed no pitches and "0 אימונים".
-- Values match seedPitchData / seedTeamAgeBandData / seedPracticeData in db/reference-seed.ts.
-- Re-running is a no-op: existing rows are never changed (ON CONFLICT DO NOTHING / IS NULL).
INSERT INTO "pitch_subdivisions" ("code", "label_he", "sort_order")
VALUES
  ('whole', 'מגרש שלם', 0),
  ('half_north', 'חצי מגרש (צפון)', 1),
  ('half_south', 'חצי מגרש (דרום)', 2),
  ('third_north', 'שליש מגרש (צפון)', 3),
  ('third_center', 'שליש מגרש (מרכז)', 4),
  ('third_south', 'שליש מגרש (דרום)', 5),
  ('quarter_north_1', 'רבע מגרש (צפון 1)', 6),
  ('quarter_north_2', 'רבע מגרש (צפון 2)', 7),
  ('quarter_south_1', 'רבע מגרש (דרום 1)', 8),
  ('quarter_south_2', 'רבע מגרש (דרום 2)', 9)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "pitches" ("code", "name_he", "color_key", "surface_type", "sort_order", "allows_home_games")
VALUES
  ('vasermil_1', 'וסרמיל 1', 'green', 'synthetic', 0, true),
  ('vasermil_2', 'וסרמיל 2', 'orange', 'natural', 1, false),
  ('vasermil_3', 'וסרמיל 3', 'purple', 'natural', 2, true),
  ('vasermil_4', 'וסרמיל 4', 'black', 'natural', 3, true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "team_age_bands" ("code", "label_he", "sort_order")
VALUES
  ('noar_through_yeladim_b', 'נוער עד ילדים ב', 0),
  ('yeladim_g_through_trum_g', 'ילדים ג עד טרום ג', 1),
  ('football_school', 'בית ספר לכדורגל', 2)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "team_age_band_subdivisions" ("age_band_code", "subdivision_code")
SELECT v.age_band_code, v.subdivision_code
FROM (
  VALUES
    ('noar_through_yeladim_b', 'whole'),
    ('noar_through_yeladim_b', 'half_north'),
    ('noar_through_yeladim_b', 'half_south'),
    ('yeladim_g_through_trum_g', 'whole'),
    ('yeladim_g_through_trum_g', 'half_north'),
    ('yeladim_g_through_trum_g', 'half_south'),
    ('yeladim_g_through_trum_g', 'third_north'),
    ('yeladim_g_through_trum_g', 'third_center'),
    ('yeladim_g_through_trum_g', 'third_south'),
    ('yeladim_g_through_trum_g', 'quarter_north_1'),
    ('yeladim_g_through_trum_g', 'quarter_north_2'),
    ('yeladim_g_through_trum_g', 'quarter_south_1'),
    ('yeladim_g_through_trum_g', 'quarter_south_2'),
    ('football_school', 'whole'),
    ('football_school', 'half_north'),
    ('football_school', 'half_south')
) AS v(age_band_code, subdivision_code)
WHERE NOT EXISTS (
  SELECT 1 FROM "team_age_band_subdivisions" existing
  WHERE existing."age_band_code" = v.age_band_code
    AND existing."subdivision_code" = v.subdivision_code
);
--> statement-breakpoint
INSERT INTO "football_school_schedule_rules"
  ("rule_key", "weekdays", "start_time", "end_time", "allowed_subdivisions", "biweekly", "note_he")
VALUES
  ('weekday_window', '0,1,2,3', '16:00', '20:00', 'whole,half_north,half_south', false, 'ימי א–ד'),
  ('thursday_league', '4', '17:00', '20:00', 'whole,half_north,half_south', true, 'ליגה פנימית — פעם בשבועיים')
ON CONFLICT ("rule_key") DO NOTHING;
--> statement-breakpoint
-- Age band per team (only where it is still empty), so each team gets its allowed pitch parts.
UPDATE "teams" t
SET "age_band_code" = v.age_band_code
FROM (
  VALUES
    ('נוער', 'noar_through_yeladim_b'),
    ('נערים א', 'noar_through_yeladim_b'),
    ('נערים ב', 'noar_through_yeladim_b'),
    ('נערים ג', 'noar_through_yeladim_b'),
    ('ילדים א אדום', 'noar_through_yeladim_b'),
    ('ילדים א לבן', 'noar_through_yeladim_b'),
    ('ילדים ב אדום', 'noar_through_yeladim_b'),
    ('ילדים ב לבן', 'noar_through_yeladim_b'),
    ('ילדות א', 'noar_through_yeladim_b'),
    ('ילדות ב', 'noar_through_yeladim_b'),
    ('ילדים ג אדום', 'yeladim_g_through_trum_g'),
    ('ילדים ג לבן', 'yeladim_g_through_trum_g'),
    ('טרום א אדום', 'yeladim_g_through_trum_g'),
    ('טרום א לבן', 'yeladim_g_through_trum_g'),
    ('טרום ב אדום', 'yeladim_g_through_trum_g'),
    ('טרום ב לבן', 'yeladim_g_through_trum_g'),
    ('טרום ג אדום', 'yeladim_g_through_trum_g'),
    ('טרום ג לבן', 'yeladim_g_through_trum_g'),
    ('בית ספר לכדורגל', 'football_school'),
    -- Short names used by the first teams migration (20261004200046), still on the live database.
    ('ילדים א', 'noar_through_yeladim_b'),
    ('ילדים ב', 'noar_through_yeladim_b'),
    ('ילדים ב ל', 'noar_through_yeladim_b'),
    ('ילדים ג', 'yeladim_g_through_trum_g'),
    ('ילדים ג ל', 'yeladim_g_through_trum_g'),
    ('טרום א', 'yeladim_g_through_trum_g'),
    ('טרום א ל', 'yeladim_g_through_trum_g'),
    ('טרום ב', 'yeladim_g_through_trum_g'),
    ('טרום ב ל', 'yeladim_g_through_trum_g'),
    ('טרום ג', 'yeladim_g_through_trum_g'),
    ('בית ספר', 'football_school')
) AS v(team_name, age_band_code)
WHERE t."name" = v.team_name
  AND t."age_band_code" IS NULL;
