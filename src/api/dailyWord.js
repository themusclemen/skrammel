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
