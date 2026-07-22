import { supabase, isSupabaseConfigured } from "../supabase.js";

// Sparar bara om det nya resultatet slår spelarens tidigare bästa (fler
// bokstäver, eller samma antal på kortare tid) — till skillnad från alla
// andra spels api-moduler, som bara lägger till en ny rad (scores) eller
// litar på databasens onConflict-upsert utan jämförelse (dailyWord.js/
// blixtWords.js). hets_scores har en rad per spelare (user_id som
// primärnyckel), så "bättre än existerande rad" måste avgöras klient-sidigt
// innan upsert:en görs.
export async function submitHetsScore(userId, displayName, bestLength, bestTimeMs) {
  if (!isSupabaseConfigured || bestLength <= 0) return;

  const { data: existing, error: fetchError } = await supabase
    .from("hets_scores")
    .select("best_length, best_time_ms")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const isBetter =
    !existing ||
    bestLength > existing.best_length ||
    (bestLength === existing.best_length && bestTimeMs < existing.best_time_ms);
  if (!isBetter) return;

  const { error } = await supabase.from("hets_scores").upsert(
    {
      user_id: userId,
      display_name: displayName,
      best_length: bestLength,
      best_time_ms: bestTimeMs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// Spelarens eget rekord, hämtat INNAN en runda startar — visas som ett
// ständigt mål under hela spelet (se HetsGameScreen), inte bara i efterhand
// på topplistan.
export async function fetchMyHetsBest(userId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("hets_scores")
    .select("best_length, best_time_ms")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchHetsLeaderboard() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hets_scores")
    .select("display_name, best_length, best_time_ms")
    .order("best_length", { ascending: false })
    .order("best_time_ms", { ascending: true })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}
