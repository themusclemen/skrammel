-- Hets: soloutmaning på tid. Datorn slumpar N blandade bokstäver (start 3,
-- +1 varje klarad runda) som garanterat innehåller minst ett riktigt ord
-- (se src/game/hetsWords.js); spelaren har 20 sekunder på sig att skriva
-- VILKET giltigt ord som helst som använder exakt de bokstäverna (fri
-- ordning, inget kvar) — inte bara datorns ursprungsval. Ingen motståndare,
-- så till skillnad från Blixt/Skrammelpaj är detta en ren personbästa-tabell:
-- en rad per spelare (user_id som primärnyckel), inte en rad per omgång.
-- Ingen security definer-funktion behövs (till skillnad från
-- blixt_leaderboard/skrammelpaj_leaderboard) eftersom varje rad redan är
-- offentligt läsbar utan att korsa någon annan spelares privata rader.
create table hets_scores (
  user_id uuid primary key references auth.users(id),
  display_name text,
  best_length int not null,
  best_time_ms int not null,
  updated_at timestamptz not null default now()
);

alter table hets_scores enable row level security;

create policy "Public can read hets_scores"
  on hets_scores for select using (true);

create policy "Users can insert their own hets score"
  on hets_scores for insert with check (auth.uid() = user_id);

create policy "Users can update their own hets score"
  on hets_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
