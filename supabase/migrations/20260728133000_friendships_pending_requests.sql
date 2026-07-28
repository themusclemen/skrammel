-- Lägger till sök-baserade vänförfrågningar ovanpå det befintliga
-- länk-baserade flödet (som fortfarande skriver raden direkt som
-- "accepted"). default 'accepted' gör detta bakåtkompatibelt: alla
-- befintliga rader skapades via länk-flödet och var redan bekräftade
-- vänskap, så de blir korrekt "accepted" utan någon separat backfill.
alter table friendships add column status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

drop policy "Addressee confirms a friendship by inserting the row" on friendships;

create policy "Addressee confirms a friendship by inserting the row"
  on friendships for insert
  with check (auth.uid() = addressee_id and status = 'accepted');

create policy "Requester can send a pending friend request"
  on friendships for insert
  with check (auth.uid() = requester_id and status = 'pending');

create policy "Addressee can accept a pending friend request"
  on friendships for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status = 'accepted');
