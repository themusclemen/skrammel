import { supabase, isSupabaseConfigured } from "../supabase.js";

export async function fetchDisplayName(userId) {
  if (!isSupabaseConfigured) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return data?.display_name ?? null;
}
