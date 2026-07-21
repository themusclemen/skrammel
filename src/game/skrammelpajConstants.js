export const SKRAMMELPAJ_WORD_COUNT = 4;
export const SKRAMMELPAJ_MIN_TOTAL_LETTERS = 20;
export const SKRAMMELPAJ_MAX_TOTAL_LETTERS = 25;
export const SKRAMMELPAJ_DURATION_SECONDS = 2 * 60;
// Hur många ord som (via findWordsInSource) måste gå att bilda av den
// hopslagna poolen för att den ska godkännas — annars känns matchen
// omöjlig eller övertydlig redan från start. Samma idé som Blixts
// BLIXT_MIN_FINDABLE/MAX_FINDABLE, men bredare eftersom poolen är
// betydligt större (20-25 bokstäver mot Blixts 8).
export const SKRAMMELPAJ_MIN_FINDABLE = 80;
export const SKRAMMELPAJ_MAX_FINDABLE = 600;
// Måste hållas i synk med talet 20 i skrammelpaj_open_challenge_count-
// policyn (supabase/schema.sql).
export const SKRAMMELPAJ_MAX_OPEN_CHALLENGES = 20;
// Hur länge en spelare får sitta på sin tur innan matchen förloras genom
// övergivande — skild från de aktiva 2 minuterna i SkrammelpajGameScreen,
// som bara räknas medan spelskärmen faktiskt är öppen.
export const SKRAMMELPAJ_TURN_DEADLINE_HOURS = 72;
// Hur länge en mottagen utmaning får ligga obesvarad innan den automatiskt
// ignoreras — skild från 72-timmarsgränsen ovan, som bara gäller EFTER att
// matchen accepterats.
export const SKRAMMELPAJ_ACCEPT_DEADLINE_HOURS = 24;
