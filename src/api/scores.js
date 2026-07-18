import { supabase, isSupabaseConfigured } from "../supabase.js";

export async function submitScore(userId, date, score, words, displayName, levelTimes) {
  if (!isSupabaseConfigured) return; // Ingen backend lokalt — inget att spara till.

  return supabase.from("scores").insert({
    user_id: userId,
    date,
    score,
    words_found: words,
    display_name: displayName,
    level_times: levelTimes ?? {},
  });
}

// Vilka datum den inloggade spelaren redan har spelat — används för att
// markera klarade dagar i arkivet.
export async function fetchUserPlayedDates(userId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("scores").select("date").eq("user_id", userId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.date))];
}

// Har spelaren redan spelat ett givet datum? Används för att fånga en repris
// av dagens ord innan spelet startar (se ReplayConfirmModal), utan att hämta
// hela arkiv-listan.
export async function hasPlayedDate(userId, date) {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await supabase
    .from("scores").select("id").eq("user_id", userId).eq("date", date).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// Spelarens hela resultat-historik i ett enda anrop — underlag för både
// spelstrecket (computeStreak) och bästa uppnådda nivå (bestLevelReached)
// på hem- och resultatskärmen.
export async function fetchUserStats(userId) {
  if (!isSupabaseConfigured) return { playedDates: [], levelTimesList: [] };

  const { data, error } = await supabase
    .from("scores").select("date, level_times").eq("user_id", userId);
  if (error) throw error;

  const rows = data ?? [];
  return {
    playedDates: [...new Set(rows.map((r) => r.date))],
    levelTimesList: rows.map((r) => r.level_times ?? {}),
  };
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
