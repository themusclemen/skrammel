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
