-- Höjer taket på samtidiga öppna Blixt-matcher från 20 till 50 (både
-- funktionen blixt_open_challenge_count används av, och insert-policyn
-- som kollar taket för både skapare och mottagare).

create or replace function blixt_open_challenge_count(target_user_id uuid)
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

alter policy "Creator can create a challenge within caps"
  on blixt_challenges
  with check (
    auth.uid() = creator_id
    and status = 'pending'
    and blixt_open_challenge_count(auth.uid()) < 50
    and blixt_open_challenge_count(opponent_id) < 50
  );
