-- Global Blixt-topplista (se BlixtLeaderboardScreen): rankar spelare efter
-- antal vunna matcher totalt, oavsett motståndare. RLS på blixt_challenges/
-- blixt_scores begränsar annars läsning till egna utmaningar, så
-- aggregeringen görs här med security definer — funktionen exponerar bara
-- summerade siffror per spelare, aldrig vem som mötte vem eller enskilda
-- matchresultat.
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
