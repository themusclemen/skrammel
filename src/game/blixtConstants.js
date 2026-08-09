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
// localStorage-nyckel för "Visa inte denna text igen" på förklaringsskärmen.
export const BLIXT_SKIP_INFO_KEY = "skrammel_blixt_skip_info";
// En avslutad match döljs automatiskt ur "Resultat"-listan ett dygn efter
// att den blev klar (bara döljs, raderas inte — se dismissedMatches.js och
// BlixtScreen.jsx för varför: topplistan räknar fortfarande raden).
export const BLIXT_COMPLETED_VISIBLE_MS = 24 * 60 * 60 * 1000;
// localStorage-nyckel-prefix (+ userId) för matcher spelaren själv dolt
// manuellt innan dygnsgränsen ovan — se dismissedMatches.js.
export const BLIXT_DISMISSED_STORAGE_PREFIX = "skrammel_blixt_dismissed_";
// Hur sällan en automatisk "CPU utmanar dig"-nudge genereras (se
// blixtAutoCpu.js) — högst en gång per dygn, och bara om spelaren inte
// redan har en riktig obesvarad utmaning eller ett tidigare CPU-förslag
// den inte hunnit svara på.
export const BLIXT_AUTO_CPU_INTERVAL_MS = 24 * 60 * 60 * 1000;
// localStorage-nyckel-prefix (+ userId) — se blixtAutoCpu.js.
export const BLIXT_AUTO_CPU_STORAGE_PREFIX = "skrammel_blixt_auto_cpu_";
