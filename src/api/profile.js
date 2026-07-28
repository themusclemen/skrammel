import { supabase, isSupabaseConfigured } from "../supabase.js";

export const MIN_DISPLAY_NAME_LENGTH = 4;
export const MIN_SEARCH_QUERY_LENGTH = 3;

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

// Konton skapade innan profiles-tabellen fylldes i vid signup saknar en
// rad här — skapas tyst första gången de loggar in (se App.jsx), så de blir
// sökbara utan något separat migreringssteg. Om namnet krockar med någon
// annans (möjligt bara för dessa äldre konton, från innan display_name
// blev unikt) skapas ingen rad — användaren blir sökbar först om/när de
// byter till ett unikt namn.
export async function ensureProfileExists(userId, displayName) {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, display_name: displayName.trim() });
  if (insertError && insertError.code !== "23505") throw insertError;
}

// Fritextsökning bland spelare (minst MIN_SEARCH_QUERY_LENGTH tecken krävs
// av anroparen, se FriendsScreen) — excludeIds filtrerar bort en själv och
// redan-vänner client-side istället för en SQL "not in", enklare och
// tillräckligt snabbt för de få träffar en cap på 20 rader ger.
export async function searchProfiles(query, excludeIds = []) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .ilike("display_name", `%${escapeLikePattern(query.trim())}%`)
    .limit(20);
  if (error) throw error;

  const exclude = new Set(excludeIds);
  return (data ?? []).filter((row) => !exclude.has(row.id));
}
