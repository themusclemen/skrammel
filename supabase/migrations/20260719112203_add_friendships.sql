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
