-- Idempotent reference data: סבב 1–5 and the standard training lengths.
-- Re-running is a no-op for rows that already exist (WHERE NOT EXISTS).
-- Times match ROTATION_PRESETS / DURATION_PRESETS in lib/pitch-rules.ts.
INSERT INTO "rotation_templates" ("rotation_number", "weekday", "label_he")
SELECT v.rotation_number, v.weekday, v.label_he
FROM (
  VALUES
    (1::integer, 0::integer, 'סבב 1'::text),
    (2::integer, NULL::integer, 'סבב 2'::text),
    (3::integer, NULL::integer, 'סבב 3'::text),
    (4::integer, NULL::integer, 'סבב 4'::text),
    (5::integer, NULL::integer, 'סבב 5'::text)
) AS v(rotation_number, weekday, label_he)
WHERE NOT EXISTS (
  SELECT 1
  FROM "rotation_templates" existing
  WHERE existing."rotation_number" = v.rotation_number
);
--> statement-breakpoint
INSERT INTO "rotation_template_times" ("rotation_template_id", "sequence", "start_time")
SELECT t."id", v.sequence, v.start_time
FROM (
  VALUES
    (1::integer, 0::integer, '16:30'::text),
    (2::integer, 0::integer, '16:30'::text),
    (2::integer, 1::integer, '18:30'::text),
    (3::integer, 0::integer, '16:00'::text),
    (3::integer, 1::integer, '17:45'::text),
    (3::integer, 2::integer, '19:15'::text),
    (4::integer, 0::integer, '15:30'::text),
    (4::integer, 1::integer, '17:00'::text),
    (4::integer, 2::integer, '18:30'::text),
    (4::integer, 3::integer, '20:00'::text),
    (5::integer, 0::integer, '08:30'::text),
    (5::integer, 1::integer, '10:00'::text),
    (5::integer, 2::integer, '11:30'::text),
    (5::integer, 3::integer, '13:00'::text),
    (5::integer, 4::integer, '14:30'::text)
) AS v(rotation_number, sequence, start_time)
JOIN "rotation_templates" t ON t."rotation_number" = v.rotation_number
WHERE NOT EXISTS (
  SELECT 1
  FROM "rotation_template_times" existing
  WHERE existing."rotation_template_id" = t."id"
    AND existing."sequence" = v.sequence
);
--> statement-breakpoint
INSERT INTO "training_session_durations" ("minutes", "label_he")
SELECT v.minutes, v.label_he
FROM (
  VALUES
    (60::integer, 'שעה'::text),
    (105::integer, 'שעה 45 דקות'::text),
    (120::integer, 'שעתיים'::text)
) AS v(minutes, label_he)
WHERE NOT EXISTS (
  SELECT 1
  FROM "training_session_durations" existing
  WHERE existing."minutes" = v.minutes
);
