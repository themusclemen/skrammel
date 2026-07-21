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
