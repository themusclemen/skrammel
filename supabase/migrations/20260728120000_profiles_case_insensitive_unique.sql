-- profiles.display_name hade tidigare bara ett vanligt (skiftlägeskänsligt)
-- unique-constraint, satt när tabellen skapades men aldrig faktiskt använd
-- av appen (visningsnamn låg bara i auth-metadata). Nu när visningsnamn ska
-- vara unikt vid kontoskapande behöver det vara skiftlägesokänsligt också
-- ("Anna" och "anna" ska räknas som samma namn) — annars kan två personer
-- ta praktiskt taget samma namn bara genom att variera versaler/gemener.
alter table profiles drop constraint if exists profiles_display_name_key;

create unique index profiles_display_name_lower_idx on profiles (lower(display_name));
