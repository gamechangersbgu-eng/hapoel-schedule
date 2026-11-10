-- Full team names on the live database. The first teams migration (20261004200046) used short
-- names ("ילדים ב ל", "טרום ג", "בית ספר"); the club's list names every team with its colour.
-- Ids stay the same, so trainings, games and coaches keep pointing at the same rows.
-- A row is renamed only if no other row already has the full name. Re-running is a no-op.
-- services/scraper/db-teams.ts uses the same full names.
UPDATE "teams" t
SET "name" = v.full_name
FROM (
  VALUES
    ('ילדים א', 'ילדים א אדום'),
    ('ילדים ב', 'ילדים ב אדום'),
    ('ילדים ב ל', 'ילדים ב לבן'),
    ('ילדים ג', 'ילדים ג אדום'),
    ('ילדים ג ל', 'ילדים ג לבן'),
    ('טרום א', 'טרום א אדום'),
    ('טרום א ל', 'טרום א לבן'),
    ('טרום ב', 'טרום ב אדום'),
    ('טרום ב ל', 'טרום ב לבן'),
    ('טרום ג', 'טרום ג אדום'),
    ('בית ספר', 'בית ספר לכדורגל')
) AS v(short_name, full_name)
WHERE t."name" = v.short_name
  AND NOT EXISTS (SELECT 1 FROM "teams" other WHERE other."name" = v.full_name);
