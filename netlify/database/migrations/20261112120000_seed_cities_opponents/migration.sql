-- Cities, opponent associations, and away-game departures.
-- db:migrate:apply runs data.ts in this folder after this statement, before
-- the migration is marked applied. data.ts calls departureFor (lib/game-rules.ts).
-- Safe to run again: a city that already exists keeps its minutes and north flag,
-- a non-null opponent or game city_id is kept, and a departure already stored is kept.
SELECT 1;
