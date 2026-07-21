import { supabase, isSupabaseConfigured } from "../supabase.js";
import { fetchFriends } from "./friends.js";
import { letterCounts } from "../game/letters.js";
import { SKRAMMELPAJ_TURN_DEADLINE_HOURS, SKRAMMELPAJ_ACCEPT_DEADLINE_HOURS } from "../game/skrammelpajConstants.js";

export async function createChallenge(creatorId, creatorName, opponentId, opponentName, letters) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("skrammelpaj_challenges")
    .insert({
      creator_id: creatorId,
      creator_display_name: creatorName,
      opponent_id: opponentId,
      opponent_display_name: opponentName,
      letters,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Vid accept blir det mottagarens (den utmanades) tur — trevligare att den
// som blev utmanad får sätta tonen med första draget än att utmanaren, som
// redan valde tillfället, även får spela först. Turen och dess
// 72-timmarsklocka startar här, inte vid utmaningens skapande.
export async function respondToChallenge(challenge, accept) {
  if (!isSupabaseConfigured) return;
  const update = accept
    ? {
        status: "accepted",
        current_turn_user_id: challenge.opponent_id,
        turn_started_at: new Date().toISOString(),
      }
    : { status: "declined" };
  const { error } = await supabase.from("skrammelpaj_challenges").update(update).eq("id", challenge.id);
  if (error) throw error;
}

// Bara oavgjorda utmaningar (mottagaren har ännu inte antagit) går att ta
// bort — till skillnad från Blixt tillåts inte radering av en match som
// redan är accepterad, eftersom Skrammelpaj är en lång, pågående duell
// (många drag) snarare än en enda spelad runda; att hoppa av en pågående
// match hanteras av 72-timmarsgränsen (forfeit), inte radering.
export async function deleteChallenge(challengeId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("skrammelpaj_challenges").delete().eq("id", challengeId);
  if (error) throw error;
}

async function completeChallenge(challengeId, winnerId, loserId, endReason) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("skrammelpaj_challenges")
    .update({
      status: "completed",
      winner_id: winnerId,
      loser_id: loserId,
      end_reason: endReason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", challengeId);
  if (error) throw error;
}

async function advanceTurn(challengeId, nextTurnUserId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("skrammelpaj_challenges")
    .update({ current_turn_user_id: nextTurnUserId, turn_started_at: new Date().toISOString() })
    .eq("id", challengeId);
  if (error) throw error;
}

// Poolen efter en given sekvens av drag — subtraherar varje spelat ords
// bokstäver (i turordning) från den ursprungliga, blandade poolen.
export function computeRemainingCounts(challenge, moves) {
  const counts = letterCounts(challenge.letters);
  for (const move of moves) {
    const used = letterCounts(move.word);
    for (const [letter, n] of Object.entries(used)) {
      counts[letter] = (counts[letter] ?? 0) - n;
    }
  }
  return counts;
}

function totalLetters(counts) {
  return Object.values(counts).reduce((sum, n) => sum + Math.max(n, 0), 0);
}

// Lägger in draget. Matchen avgörs direkt bara om poolen bokstavligen är
// tom — så länge det finns bokstäver kvar (hur omöjliga de än är att bilda
// ord av, t.ex. "XY") går turen vidare som vanligt, så motståndaren alltid
// får chansen att försöka själv istället för att hoppas över i onödan.
export async function submitMove(challenge, moves, userId, displayName, word) {
  const moveNumber = moves.length + 1;
  if (isSupabaseConfigured) {
    const { error } = await supabase.from("skrammelpaj_moves").insert({
      challenge_id: challenge.id,
      user_id: userId,
      display_name: displayName,
      move_number: moveNumber,
      word,
    });
    if (error) throw error;
  }

  const opponentId = challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
  const remaining = computeRemainingCounts(challenge, [...moves, { word }]);

  if (totalLetters(remaining) === 0) {
    await completeChallenge(challenge.id, userId, opponentId, "no_words_left");
    return { completed: true, winnerId: userId, endReason: "no_words_left" };
  }

  await advanceTurn(challenge.id, opponentId);
  return { completed: false };
}

// Självrapporterat nederlag: spelaren vars tur det är hann inte hitta ett
// ord (timeout), eller öppnade sin tur och poolen var redan omöjlig (ärvt
// läge, t.ex. om motståndarens klient av någon anledning missade
// no_words_left-kollen efter sitt eget drag).
export async function reportLoss(challenge, userId, endReason) {
  const opponentId = challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
  await completeChallenge(challenge.id, opponentId, userId, endReason);
}

// Ingen cron finns i appen — 72-timmarsgränsen kollas lat, av vem som helst
// av deltagarna som råkar ha matchlistan öppen, samma självrapporterande
// mönster som resten av spelet. Körs vid varje hub-laddning; anropar
// completeChallenge för utgångna matcher och returnerar om något ändrades
// (så anroparen vet att den ska hämta om listan).
export async function applyPendingForfeits(challenges, userId) {
  const deadlineMs = SKRAMMELPAJ_TURN_DEADLINE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const stale = challenges.filter(
    (c) =>
      c.status === "accepted" &&
      (c.creator_id === userId || c.opponent_id === userId) &&
      c.turn_started_at &&
      now - new Date(c.turn_started_at).getTime() > deadlineMs
  );

  for (const c of stale) {
    const loserId = c.current_turn_user_id;
    const winnerId = loserId === c.creator_id ? c.opponent_id : c.creator_id;
    try {
      await completeChallenge(c.id, winnerId, loserId, "forfeit");
    } catch {
      // Motståndarens klient (eller en annan flik) hann redan avsluta
      // samma match — inget att göra, nästa hämtning ser rätt slutstatus.
    }
  }
  return stale.length > 0;
}

// Samma lata, self-reporterade mönster som ovan, men för oavgjorda
// utmaningar: mottagaren har 24 timmar på sig att anta/ignorera innan
// utmaningen automatiskt ignoreras (status "declined", samma väg som ett
// aktivt "Ignorera"-klick).
export async function applyPendingExpirations(challenges, userId) {
  const deadlineMs = SKRAMMELPAJ_ACCEPT_DEADLINE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const stale = challenges.filter(
    (c) =>
      c.status === "pending" &&
      (c.creator_id === userId || c.opponent_id === userId) &&
      now - new Date(c.created_at).getTime() > deadlineMs
  );

  for (const c of stale) {
    try {
      await respondToChallenge(c, false);
    } catch {
      // Motparten hann redan svara, eller en annan flik hann redan
      // markera den — inget att göra, nästa hämtning ser rätt status.
    }
  }
  return stale.length > 0;
}

// "needs_response": jag är opponent, pending — måste anta/ignorera.
// "waiting_opponent_response": jag är creator, pending.
// "your_turn": accepted, current_turn_user_id är jag.
// "waiting_opponent_turn": accepted, motståndarens tur.
// "completed": matchen är avgjord.
export function classifyChallenge(challenge, userId) {
  const isCreator = challenge.creator_id === userId;
  if (challenge.status === "pending") {
    return isCreator ? "waiting_opponent_response" : "needs_response";
  }
  if (challenge.status === "accepted") {
    return challenge.current_turn_user_id === userId ? "your_turn" : "waiting_opponent_turn";
  }
  return "completed";
}

// Ignorerade (declined) utmaningar ska inte synas i någon lista, per samma
// beslut som Blixt.
export async function fetchMyChallenges(userId) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("skrammelpaj_challenges")
    .select("*, skrammelpaj_moves(*)")
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .neq("status", "declined")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((c) => ({
    ...c,
    skrammelpaj_moves: [...(c.skrammelpaj_moves ?? [])].sort((a, b) => a.move_number - b.move_number),
  }));
}

// Räknar rader med status pending/accepted där jag är part — samma
// "X/tak pågående"-mönster som Blixts openChallengeCount.
export function openChallengeCount(challenges, userId) {
  return challenges.filter(
    (c) =>
      (c.status === "pending" || c.status === "accepted") &&
      (c.creator_id === userId || c.opponent_id === userId)
  ).length;
}

const END_REASON_LABELS = {
  no_words_left: (won, name) => (won ? `${name} hittade inget ord` : "Du hittade inget ord"),
  timeout: (won, name) => (won ? `${name} hann inte i tid` : "Du hann inte i tid"),
  forfeit: (won, name) => (won ? `${name} svarade inte inom 72 timmar` : "Du svarade inte inom 72 timmar"),
  give_up: (won, name) => (won ? `${name} gav upp` : "Du gav upp"),
};

// Läsbar förklaring till varför en avslutad match slutade som den gjorde —
// delad mellan hub-vyns resultatkort och resultatskärmen som visas direkt
// efter ett eget avgörande drag.
export function describeEndReason(endReason, won, opponentName) {
  return END_REASON_LABELS[endReason]?.(won, opponentName) ?? "";
}

// Ren funktion: för varje avslutad match, tillskriv vinst/förlust till rätt
// motståndare utifrån winner_id/loser_id (inget self-join behövs, till
// skillnad från Blixts computeChallengeStats — vinnaren står redan direkt
// på raden).
export function computeChallengeStats(challenges, userId) {
  const byOpponent = new Map();

  for (const challenge of challenges) {
    if (challenge.status !== "completed") continue;
    const isCreator = challenge.creator_id === userId;
    const opponentId = isCreator ? challenge.opponent_id : challenge.creator_id;
    const opponentName = isCreator ? challenge.opponent_display_name : challenge.creator_display_name;

    if (!byOpponent.has(opponentId)) {
      byOpponent.set(opponentId, { opponentId, opponentName, wins: 0, losses: 0 });
    }
    const entry = byOpponent.get(opponentId);
    if (challenge.winner_id === userId) entry.wins += 1;
    else if (challenge.loser_id === userId) entry.losses += 1;
  }

  return [...byOpponent.values()].sort((a, b) => b.wins - a.wins);
}

// Global topplista, rankad efter flest vunna Skrammelpaj-matcher totalt.
export async function fetchLeaderboard() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("skrammelpaj_leaderboard");
  if (error) throw error;
  return (data ?? []).sort((a, b) => b.wins - a.wins || b.matches_played - a.matches_played);
}

// Samma rankning, filtrerad till spelaren själv + vänner — samma
// klient-sidiga filtreringsmönster som Blixts fetchFriendsBlixtLeaderboard.
export async function fetchFriendsLeaderboard(userId) {
  if (!isSupabaseConfigured) return [];
  const [all, friends] = await Promise.all([fetchLeaderboard(), fetchFriends(userId)]);
  const ids = new Set([userId, ...friends.map((f) => f.friendId)]);
  return all.filter((row) => ids.has(row.user_id));
}
