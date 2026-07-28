import { supabase, isSupabaseConfigured } from "../supabase.js";

export const MIN_DISPLAY_NAME_LENGTH = 4;

// ilike tolkar %/_ som wildcards, så de måste escapas innan de går in i ett
// exakt-match-mönster — annars skulle t.ex. "A_na" felaktigt matcha "Anna".
export function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, (match) => `\\${match}`);
}

// display_name måste vara unikt (skiftlägesokänsligt, se profiles-tabellens
// unique-index) — används både för en snabb "ledigt/upptaget"-koll medan
// man skriver, och som facit vid själva kontoskapandet.
export async function isDisplayNameTaken(displayName) {
  if (!isSupabaseConfigured) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", escapeLikePattern(displayName.trim()))
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

export async function createProfile(userId, displayName) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("profiles").insert({ id: userId, display_name: displayName.trim() });
  if (error) throw error;
}
