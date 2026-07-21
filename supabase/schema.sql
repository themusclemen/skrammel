-- Skrammel — Supabase-schema
-- Klistra in i SQL-editorn på supabase.com för det nya "skrammel-beta"-projektet.
-- Speglar minikors mönster: publik SELECT för spel/topplista, skrivrätt
-- begränsad till egna rader (eller admin-mailen för daily_words).

create table daily_words (
  date date primary key,
  word text not null,
  created_at timestamptz not null default now()
);

alter table daily_words enable row level security;

create policy "Public can read daily_words"
  on daily_words for select
  using (true);

create policy "Only admin can write daily_words"
  on daily_words for all
  using (auth.jwt() ->> 'email' = 'themusclemen@gmail.com')
  with check (auth.jwt() ->> 'email' = 'themusclemen@gmail.com');


create table scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date text not null,
  score int not null,
  words_found jsonb not null default '[]'::jsonb,
  display_name text,
  -- { "Dagens utmaning": 42, "PROFFS": 88, ... } — sekunder från spelstart
  -- när respektive nivå nåddes. Underlag för framtida topplistor per nivå.
  level_times jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table scores enable row level security;

create policy "Public can read scores"
  on scores for select
  using (true);

create policy "Users can insert their own scores"
  on scores for insert
  with check (auth.uid() = user_id);


create table profiles (
  id uuid primary key references auth.users(id),
  display_name text unique,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Public can read profiles"
  on profiles for select
  using (true);

create policy "Users can upsert their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- Vänskap bekräftas genom att öppna en delad inbjudningslänk (bär bara
-- requesterns user-id, ingen token) — en rad = en bekräftad vänskap,
-- skriven av den som bekräftar (addressee). user_a/user_b (minsta/största
-- uuid) + unique förhindrar dubbletter oavsett vem som bjöd in vem.
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id),
  requester_display_name text not null,
  addressee_id uuid not null references auth.users(id),
  addressee_display_name text not null,
  created_at timestamptz not null default now(),
  user_a uuid generated always as (least(requester_id, addressee_id)) stored,
  user_b uuid generated always as (greatest(requester_id, addressee_id)) stored,
  unique (user_a, user_b),
  check (requester_id <> addressee_id)
);

alter table friendships enable row level security;

create policy "Involved users can read their friendships"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Addressee confirms a friendship by inserting the row"
  on friendships for insert
  with check (auth.uid() = addressee_id);

create policy "Either side can remove a friendship"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);


-- Blixtpussel v2: ett 1-mot-1-utmaningsspel, separat från dagens delade ord.
-- Varje utmaning har sitt eget slumpade 6-bokstavsord och en egen
-- 2-minutersgräns (se src/game/blixtConstants.js), inte dagens ord/tid.
-- En rad = en utmaning mellan creator och opponent (vem som helst som
-- någonsin postat ett resultat, inte bara en vän); resultaten ligger i
-- blixt_scores (en rad per deltagare). Namnen denormaliseras in av samma
-- skäl som friendships/scores.display_name — klienten kan inte läsa
-- auth.users. status styr flödet: pending (väntar på mottagarens
-- anta/ignorera) -> accepted (mottagaren spelar sin runda) -> completed,
-- eller pending -> declined (permanent, ingen "spela = bekräftelse" här).
create table blixt_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  creator_display_name text not null,
  opponent_id uuid not null references auth.users(id),
  opponent_display_name text not null,
  source_word text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'completed')),
  created_at timestamptz not null default now(),
  check (creator_id <> opponent_id)
);

alter table blixt_challenges enable row level security;

create policy "Participants can read their challenges"
  on blixt_challenges for select
  using (auth.uid() = creator_id or auth.uid() = opponent_id);

-- Räknar öppna (pending/accepted) matcher för en spelare oavsett om den
-- infogande användaren har läsrätt till alla raderna — security definer
-- kringgår RLS, annars skulle en insert-policy-subfråga bara se motpartens
-- rader som den infogande användaren själv redan får läsa, vilket
-- underskattar motpartens sanna antal öppna matcher.
create function blixt_open_challenge_count(target_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from blixt_challenges
  where status in ('pending', 'accepted')
    and (creator_id = target_user_id or opponent_id = target_user_id)
$$;

-- Creatorn skapar raden direkt när en oriktad Blixt-runda spelats klart och
-- en mottagare valts (se src/api/blixt.js) — taket på 20 gäller båda
-- parter, annars går det att spamma en populär slumpmotståndare förbi taket.
create policy "Creator can create a challenge within caps"
  on blixt_challenges for insert
  with check (
    auth.uid() = creator_id
    and status = 'pending'
    and blixt_open_challenge_count(auth.uid()) < 20
    and blixt_open_challenge_count(opponent_id) < 20
  );

-- Mottagaren antar/ignorerar (pending -> accepted/declined), eller
-- markerar klart efter att ha spelat sin runda (accepted -> completed).
create policy "Opponent can respond to or complete their challenge"
  on blixt_challenges for update
  using (auth.uid() = opponent_id)
  with check (auth.uid() = opponent_id and status in ('accepted', 'declined', 'completed'));

-- Låter en deltagare ta bort en oavslutad utmaning (se "Ej spelade"-tabben,
-- src/screens/BlixtScreen.jsx). Begränsat till status <> 'completed' som
-- försvar på djupet — UI:t erbjuder aldrig radering av avslutade
-- utmaningar, men policyn ska inte lita blint på klienten.
create policy "Participants can delete their unplayed challenges"
  on blixt_challenges for delete
  using (
    (auth.uid() = creator_id or auth.uid() = opponent_id)
    and status <> 'completed'
  );


-- Ett resultat per deltagare och utmaning. unique (challenge_id, user_id)
-- hindrar en deltagare från att skicka in två resultat för samma utmaning.
create table blixt_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references blixt_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  score int not null,
  words_found jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table blixt_scores enable row level security;

-- blixt_scores har ingen egen opponent_id-kolumn, så policyn måste slå upp
-- utmaningen den hör till för att avgöra vem som får läsa/skriva.
create policy "Participants can read scores for their challenges"
  on blixt_scores for select
  using (
    exists (
      select 1 from blixt_challenges c
      where c.id = blixt_scores.challenge_id
        and (c.creator_id = auth.uid() or c.opponent_id = auth.uid())
    )
  );

create policy "Participants can insert their own score"
  on blixt_scores for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from blixt_challenges c
      where c.id = blixt_scores.challenge_id
        and (c.creator_id = auth.uid() or c.opponent_id = auth.uid())
    )
  );

-- Global Blixt-topplista (se BlixtLeaderboardScreen): rankar spelare efter
-- antal vunna matcher totalt, oavsett motståndare. RLS ovan begränsar
-- annars läsning till egna utmaningar, så aggregeringen görs här med
-- security definer — funktionen exponerar bara summerade siffror per
-- spelare, aldrig vem som mötte vem eller enskilda matchresultat.
create function blixt_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  wins integer,
  losses integer,
  matches_played integer,
  best_score integer
)
language sql
security definer
set search_path = public
as $$
  with results as (
    select
      mine.user_id,
      mine.display_name,
      mine.score as my_score,
      opp.score as opp_score
    from blixt_challenges bc
    join blixt_scores mine on mine.challenge_id = bc.id
    join blixt_scores opp on opp.challenge_id = bc.id and opp.user_id <> mine.user_id
    where bc.status = 'completed'
  )
  select
    user_id,
    max(display_name) as display_name,
    count(*) filter (where my_score > opp_score)::integer as wins,
    count(*) filter (where my_score < opp_score)::integer as losses,
    count(*)::integer as matches_played,
    max(my_score)::integer as best_score
  from results
  group by user_id
$$;

grant execute on function blixt_leaderboard() to anon, authenticated;


-- Kuraterad ordpool för Blixtpussel-källord (ersätter den gamla
-- rent klient-slumpade suggestSourceWord()-vägen, se src/api/blixt.js).
-- Admin genererar kandidater i bulk på /admin/blixt, godkänner de bra
-- (approved = true) och kastar resten (delete) — pickBlixtWord() drar
-- sen slumpmässigt bland de godkända, med upprepning tillåten precis
-- som dagens ord-generatorn kan slumpa fram samma ord flera gånger.
create table blixt_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  findable_count int not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table blixt_words enable row level security;

-- Bara godkända ord är läsbara publikt (klienten slumpar bland dem vid
-- spelstart) — okuraterade kandidater ska inte läcka ut innan admin sett dem.
create policy "Public can read approved blixt_words"
  on blixt_words for select
  using (approved = true);

-- "for all" täcker även select, så adminen ser okuraterade rader också
-- (den publika policyn ovan läggs bara till, inte ersätter, för alla andra).
create policy "Only admin can write blixt_words"
  on blixt_words for all
  using (auth.jwt() ->> 'email' = 'themusclemen@gmail.com')
  with check (auth.jwt() ->> 'email' = 'themusclemen@gmail.com');
