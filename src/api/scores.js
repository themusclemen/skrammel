import { supabase, isSupabaseConfigured } from "../supabase.js";

export async function submitScore(userId, date, score, words, displayName) {
  if (!isSupabaseConfigured) return; // Ingen backend lokalt — inget att spara till.

  return supabase.from("scores").insert({
    user_id: userId,
    date,
    score,
    words_found: words,
    display_name: displayName,
  });
}

export async function fetchLeaderboard(date) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("scores")
    .select("display_name, score, created_at")
    .eq("date", date)
    .order("score", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
