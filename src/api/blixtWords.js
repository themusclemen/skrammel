import { supabase, isSupabaseConfigured } from "../supabase.js";

// Publikt läsbara (approved = true) — det här är poolen pickBlixtWord()
// slumpar ur vid spelstart. Tom lista tolkas av anroparen som "inget
// kuraterat ännu, falla tillbaka på gammal on-the-fly-generering".
export async function fetchApprovedBlixtWords() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("blixt_words").select("word").eq("approved", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.word);
}

// Admin-funktioner (kräver inloggning som ADMIN_EMAIL — se RLS i schema.sql).

export async function fetchAllBlixtWords() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("blixt_words")
    .select("id, word, findable_count, approved, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// candidates: [{ word, count }]. Ignorerar dubbletter mot redan lagrade
// ord (unique constraint) — vanligt eftersom kandidatpoolen är begränsad.
export async function insertBlixtWordCandidates(candidates) {
  if (!isSupabaseConfigured || candidates.length === 0) return;
  const { error } = await supabase
    .from("blixt_words")
    .upsert(
      candidates.map((c) => ({ word: c.word, findable_count: c.count, approved: false })),
      { onConflict: "word", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function setBlixtWordApproved(id, approved) {
  const { error } = await supabase.from("blixt_words").update({ approved }).eq("id", id);
  if (error) throw error;
}

export async function deleteBlixtWord(id) {
  const { error } = await supabase.from("blixt_words").delete().eq("id", id);
  if (error) throw error;
}
