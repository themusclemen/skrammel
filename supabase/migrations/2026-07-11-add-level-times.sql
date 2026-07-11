-- Kör i SQL-editorn för det befintliga skrammel-beta-projektet.
-- schema.sql är redan uppdaterad så nya installationer får kolumnen direkt.

alter table scores
  add column if not exists level_times jsonb not null default '{}'::jsonb;
