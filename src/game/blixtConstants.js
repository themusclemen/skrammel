export const BLIXT_WORD_LENGTH = 8;
export const BLIXT_DURATION_SECONDS = 2 * 60;
export const BLIXT_MIN_FINDABLE = 30;
export const BLIXT_MAX_FINDABLE = 120;
// Måste hållas i synk med talet 20 i blixt_open_challenge_count-policyn
// (supabase/schema.sql).
export const BLIXT_MAX_OPEN_CHALLENGES = 20;
// Hur länge en mottagen utmaning får ligga obesvarad innan den automatiskt
// ignoreras — samma gräns och resonemang som Skrammelpajs
// SKRAMMELPAJ_ACCEPT_DEADLINE_HOURS.
export const BLIXT_ACCEPT_DEADLINE_HOURS = 24;
