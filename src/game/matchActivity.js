// Ren hjälpfunktion, delad mellan FriendsScreen (alla vänner) och
// FriendDetailScreen (en specifik vän) — grupperar en spelares
// utmaningar (Blixt eller Skrammelpaj, samma klassificerare-mönster i
// respektive api/*.js) per motståndare. "completed" räknas inte som
// pågående; "your_turn"/"needs_response" betyder att JAG måste göra
// något (blinkning), övriga pågående statusar väntar bara på motparten.
export function computeOngoingByOpponent(challenges, userId, classify) {
  const map = new Map();
  for (const challenge of challenges ?? []) {
    const opponentId = challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
    const status = classify(challenge, userId);
    if (status === "completed") continue;

    const entry = map.get(opponentId) ?? { ongoingCount: 0, needsAction: false };
    entry.ongoingCount += 1;
    if (status === "your_turn" || status === "needs_response") entry.needsAction = true;
    map.set(opponentId, entry);
  }
  return map;
}
