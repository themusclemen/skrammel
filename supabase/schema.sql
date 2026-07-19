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
