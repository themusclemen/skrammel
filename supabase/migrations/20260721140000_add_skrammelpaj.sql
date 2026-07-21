-- Skrammelpaj: async 1-mot-1-duell om en delad, krympande bokstavspool (4
-- slumpade ord, 20-25 bokstäver, blandade — se src/game/skrammelpajPool.js).
-- Till skillnad från Blixt (parallella, oberoende rundor mot samma källord)
-- är det här en riktig turordning: spelarna turas om att bilda ord ur
-- samma pool tills någon inte hittar ett ord (eller inte hinner). En rad =
-- en hel match (många drag, se skrammelpaj_moves), inte en spelad runda.
-- current_turn_user_id + turn_started_at styr vems tur det är och driver
-- både den 2-minuters aktiva klockan (klient-sidig, se
-- src/game/skrammelpajConstants.js) och 72-timmarsgränsen för övergivande
-- (self-reported av vem som helst av deltagarna, se
-- src/api/skrammelpaj.js:applyPendingForfeits — ingen cron finns i appen).
create table skrammelpaj_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  creator_display_name text not null,
  opponent_id uuid not null references auth.users(id),
  opponent_display_name text not null,
  letters text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'completed')),
  current_turn_user_id uuid references auth.users(id),
  turn_started_at timestamptz,
  winner_id uuid references auth.users(id),
  loser_id uuid references auth.users(id),
  end_reason text check (end_reason in ('timeout', 'no_words_left', 'forfeit', 'give_up')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (creator_id <> opponent_id)
);

alter table skrammelpaj_challenges enable row level security;

create policy "Participants can read their skrammelpaj challenges"
  on skrammelpaj_challenges for select
  using (auth.uid() = creator_id or auth.uid() = opponent_id);

-- Samma knäckfråga som Blixt löste: en insert-policys with-check-subfråga
-- ärver tabellens egen SELECT-policy, så den kan bara se motpartens rader om
-- den infogande användaren redan får läsa dem — därför security definer.
create function skrammelpaj_open_challenge_count(target_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from skrammelpaj_challenges
  where status in ('pending', 'accepted')
    and (creator_id = target_user_id or opponent_id = target_user_id)
$$;

create policy "Creator can create a skrammelpaj challenge within caps"
  on skrammelpaj_challenges for insert
  with check (
    auth.uid() = creator_id
    and status = 'pending'
    and skrammelpaj_open_challenge_count(auth.uid()) < 20
    and skrammelpaj_open_challenge_count(opponent_id) < 20
  );

-- Bredare än Blixts uppdateringspolicy: båda deltagarna kan behöva
-- uppdatera raden (anta/ignorera, flippa current_turn_user_id efter sitt
-- eget drag, eller markera matchen klar — antingen som förlorare
-- (timeout/omöjlig pool/gav upp) eller som vinnare (motståndarens
-- 72-timmarsgräns gick ut). Samma lätta tillitsmodell som resten av
-- appen: klienten som rapporterar ett utfall är redan den enda källan till
-- sanning för resultat (ingen server-side ordlista finns heller).
create policy "Participants can update their skrammelpaj challenge"
  on skrammelpaj_challenges for update
  using (auth.uid() = creator_id or auth.uid() = opponent_id)
  with check (
    (auth.uid() = creator_id or auth.uid() = opponent_id)
    and status in ('accepted', 'declined', 'completed')
  );

-- Bara oavgjorda (mottagaren har ännu inte antagit) matcher går att ta
-- bort — en pågående duell (accepted) kan inte städas bort i förtid, bara
-- avgöras (spelas klart, tiden går ut, eller 72-timmarsgränsen gör det åt
-- en). Snävare än Blixts "status <> completed", medvetet: Skrammelpaj är en
-- längre, pågående match, inte en enda spelad runda.
create policy "Participants can delete their unaccepted skrammelpaj challenges"
  on skrammelpaj_challenges for delete
  using (
    (auth.uid() = creator_id or auth.uid() = opponent_id)
    and status = 'pending'
  );


-- Ett drag per rad — till skillnad från Blixts blixt_scores (en rad per
-- deltagare totalt) kan en match ha många rader här, en per tur.
create table skrammelpaj_moves (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references skrammelpaj_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  move_number int not null,
  word text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, move_number)
);

alter table skrammelpaj_moves enable row level security;

create policy "Participants can read moves for their skrammelpaj challenges"
  on skrammelpaj_moves for select
  using (
    exists (
      select 1 from skrammelpaj_challenges c
      where c.id = skrammelpaj_moves.challenge_id
        and (c.creator_id = auth.uid() or c.opponent_id = auth.uid())
    )
  );

-- Turordnings-spärren: ett drag går bara att lägga in av den vars tur det
-- faktiskt är, på en accepterad match. Ordets GILTIGHET (är det ett riktigt
-- ord) kollas fortfarande bara klient-sidigt, som i Blixt/dagens ord — ingen
-- ordlista finns server-side.
create policy "Current-turn participant can insert a skrammelpaj move"
  on skrammelpaj_moves for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from skrammelpaj_challenges c
      where c.id = skrammelpaj_moves.challenge_id
        and c.status = 'accepted'
        and c.current_turn_user_id = auth.uid()
    )
  );

-- Global Skrammelpaj-topplista. Enklare än blixt_leaderboard: vinnare/
-- förlorare står redan direkt på skrammelpaj_challenges (winner_id/
-- loser_id), så inget self-join mot en per-deltagare-resultattabell behövs.
create function skrammelpaj_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  wins integer,
  losses integer,
  matches_played integer
)
language sql
security definer
set search_path = public
as $$
  with outcomes as (
    select winner_id as user_id, creator_display_name as display_name, 1 as win, 0 as loss
    from skrammelpaj_challenges where status = 'completed' and winner_id = creator_id
    union all
    select winner_id as user_id, opponent_display_name as display_name, 1 as win, 0 as loss
    from skrammelpaj_challenges where status = 'completed' and winner_id = opponent_id
    union all
    select loser_id as user_id, creator_display_name as display_name, 0 as win, 1 as loss
    from skrammelpaj_challenges where status = 'completed' and loser_id = creator_id
    union all
    select loser_id as user_id, opponent_display_name as display_name, 0 as win, 1 as loss
    from skrammelpaj_challenges where status = 'completed' and loser_id = opponent_id
  )
  select
    user_id,
    max(display_name) as display_name,
    sum(win)::integer as wins,
    sum(loss)::integer as losses,
    count(*)::integer as matches_played
  from outcomes
  group by user_id
$$;

grant execute on function skrammelpaj_leaderboard() to anon, authenticated;
