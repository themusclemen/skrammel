import { supabase, isSupabaseConfigured } from "../supabase.js";
import { buildCandidatePool, suggestSourceWord } from "../game/adminSuggest.js";
import {
  BLIXT_WORD_LENGTH,
  BLIXT_MIN_FINDABLE,
  BLIXT_MAX_FINDABLE,
} from "../game/blixtConstants.js";

// Ren klient-beräkning, ingen databas inblandad — den oriktade rundan har
// ännu ingen mottagare.
export function pickBlixtWord(dictionary) {
  const pool = buildCandidatePool(dictionary, {
    minLength: BLIXT_WORD_LENGTH,
    maxLength: BLIXT_WORD_LENGTH,
  });
  const suggestion = suggestSourceWord(pool, dictionary, {
    minFindable: BLIXT_MIN_FINDABLE,
    maxFindable: BLIXT_MAX_FINDABLE,
  });
  return suggestion.word;
}

// Infogar utmaningsraden (status "pending") och sen creatorns redan spelade
// resultat. Två sekventiella anrop, samma lätta konsistensnivå som resten
// av kodbasen (inga transaktioner används någon annanstans heller). Om
// insert avvisas (RLS, t.ex. mottagarens tak nått) kastas felet vidare —
// anroparen (vän- eller slumpflödet) avgör hur det ska hanteras.
export async function createChallenge(creatorId, creatorName, opponentId, opponentName, sourceWord, score, words) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("blixt_challenges")
    .insert({
      creator_id: creatorId,
      creator_display_name: creatorName,
      opponent_id: opponentId,
      opponent_display_name: opponentName,
      source_word: sourceWord,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: scoreError } = await supabase.from("blixt_scores").insert({
    challenge_id: data.id,
    user_id: creatorId,
    display_name: creatorName,
    score,
    words_found: words,
  });
  if (scoreError) throw scoreError;

  return data;
}

export async function respondToChallenge(challengeId, accept) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("blixt_challenges")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", challengeId);
  if (error) throw error;
}

// Unique-violation (23505, redan inskickat resultat för den här utmaningen)
// tolkas som lyckad inskickning — samma toleranta mönster som confirmFriendship.
export async function submitBlixtScore(challengeId, userId, displayName, score, words) {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("blixt_scores").insert({
    challenge_id: challengeId,
    user_id: userId,
    display_name: displayName,
    score,
    words_found: words,
  });
  if (error && error.code !== "23505") throw error;

  const { error: statusError } = await supabase
    .from("blixt_challenges")
    .update({ status: "completed" })
    .eq("id", challengeId);
  if (statusError) throw statusError;
}

// "needs_response": jag är opponent, pending — måste anta/ignorera.
// "waiting_opponent_response": jag är creator, pending.
// "your_turn": jag är opponent, accepted, ingen egen poäng än.
// "waiting_opponent_play": jag är creator, accepted.
// "completed": klar, båda resultat finns (eller kommer finnas).
export function classifyChallenge(challenge, userId) {
  const isCreator = challenge.creator_id === userId;
  if (challenge.status === "pending") {
    return isCreator ? "waiting_opponent_response" : "needs_response";
  }
  if (challenge.status === "accepted") {
    if (isCreator) return "waiting_opponent_play";
    const hasMyScore = (challenge.blixt_scores ?? []).some((s) => s.user_id === userId);
    return hasMyScore ? "waiting_opponent_play" : "your_turn";
  }
  return "completed";
}

// Ignorerade (declined) utmaningar ska inte synas i någon lista, per beslut.
export async function fetchMyChallenges(userId) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("blixt_challenges")
    .select("*, blixt_scores(*)")
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .neq("status", "declined")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// scores (inte blixt_scores) är rätt källa — redan public-select och
// innehåller alla som någonsin postat ett resultat på dagens ord.
export async function fetchRandomOpponent(userId, excludeIds) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("scores")
    .select("user_id, display_name")
    .neq("user_id", userId)
    .limit(500);
  if (error) throw error;

  const excluded = new Set(excludeIds);
  const byId = new Map();
  for (const row of data ?? []) {
    if (!excluded.has(row.user_id)) byId.set(row.user_id, row.display_name);
  }
  const candidates = [...byId.entries()];
  if (candidates.length === 0) return null;
  const [oppId, oppName] = candidates[Math.floor(Math.random() * candidates.length)];
  return { opponentId: oppId, opponentName: oppName };
}

// Ren funktion: för varje completed-utmaning, jämför de två blixt_scores-
// raderna och tillskriv vinst/förlust till rätt motståndare (lika = ingen
// av delarna). Slår ihop vänner och slumpmotståndare i samma lista.
export function computeChallengeStats(challenges, userId) {
  const byOpponent = new Map();

  for (const challenge of challenges) {
    if (challenge.status !== "completed") continue;
    const isCreator = challenge.creator_id === userId;
    const opponentId = isCreator ? challenge.opponent_id : challenge.creator_id;
    const opponentName = isCreator ? challenge.opponent_display_name : challenge.creator_display_name;
    const myScoreRow = (challenge.blixt_scores ?? []).find((s) => s.user_id === userId);
    const oppScoreRow = (challenge.blixt_scores ?? []).find((s) => s.user_id === opponentId);
    if (!myScoreRow || !oppScoreRow) continue;

    if (!byOpponent.has(opponentId)) {
      byOpponent.set(opponentId, { opponentId, opponentName, wins: 0, losses: 0 });
    }
    const entry = byOpponent.get(opponentId);
    if (myScoreRow.score > oppScoreRow.score) entry.wins += 1;
    else if (myScoreRow.score < oppScoreRow.score) entry.losses += 1;
  }

  return [...byOpponent.values()].sort((a, b) => b.wins - a.wins);
}

// Räknar rader med status pending/accepted där jag är part. Denna
// räkning är korrekt utan security-definer-funktionen, eftersom RLS redan
// låter mig se alla mina egna rader. Används för "X/20 pågående"-visning
// och för att inaktivera "Spela en blixt" vid taket.
export function openChallengeCount(challenges, userId) {
  return challenges.filter(
    (c) =>
      (c.status === "pending" || c.status === "accepted") &&
      (c.creator_id === userId || c.opponent_id === userId)
  ).length;
}
