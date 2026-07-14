import { supabase, isSupabaseConfigured } from "../supabase.js";
import { FALLBACK_WORD } from "../game/constants.js";

export async function fetchTodaysWord(date) {
  if (!isSupabaseConfigured) return FALLBACK_WORD;

  const { data, error } = await supabase
    .from("daily_words")
    .select("word")
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return FALLBACK_WORD;
  return data.word;
}

// Admin-funktioner (kräver inloggning som ADMIN_EMAIL — se RLS i schema.sql).

export async function fetchAllDailyWords() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("daily_words").select("date, word");
  if (error) throw error;
  return data ?? [];
}

export async function upsertDailyWord(date, word) {
  const { error } = await supabase.from("daily_words").upsert({ date, word }, { onConflict: "date" });
  if (error) throw error;
}

export async function deleteDailyWord(date) {
  const { error } = await supabase.from("daily_words").delete().eq("date", date);
  if (error) throw error;
}
