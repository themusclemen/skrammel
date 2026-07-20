import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchFriends } from "../api/friends.js";

// Visas direkt efter en avslutad oriktad Blixt-runda — spelaren väljer sen
// vem (om någon) hen vill utmana med resultatet. onChallengeFriend/
// onChallengeRandom gör själva skapandet (App.jsx) och kan avvisas av RLS
// (mottagarens 20-tak nått) — den här skärmen visar bara fel och tillåter
// nya försök.
export default function BlixtChooseOpponentScreen({ user, draftResult, onChallengeFriend, onChallengeRandom, onSkip }) {
  const [friends, setFriends] = useState(null);
  const [busyId, setBusyId] = useState(null); // "random" eller ett friendId
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFriends(user.id).then(setFriends).catch(() => setFriends([]));
  }, [user.id]);

  const handleFriend = async (friendId, friendName) => {
    setBusyId(friendId);
    setError(null);
    try {
      await onChallengeFriend(friendId, friendName);
    } catch {
      setError("Din vän har redan för många pågående matcher.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRandom = async () => {
    setBusyId("random");
    setError(null);
    try {
      await onChallengeRandom();
    } catch (err) {
      setError(err.message ?? "Hittade ingen ledig motståndare just nu, försök igen senare.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>⚡ Blixt spelad!</h2>
      <div style={styles.score}>{draftResult.score} poäng</div>
      <div style={{ color: T.muted }}>{draftResult.words.length} ord hittade</div>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>Vem vill du utmana med det här resultatet?</div>

      {error && <div style={styles.error}>{error}</div>}

      <button onClick={handleRandom} disabled={busyId !== null} style={styles.randomButton}>
        {busyId === "random" ? "Slumpar…" : "🎲 Slumpa motståndare"}
      </button>

      {friends === null && <div style={{ color: T.muted }}>Laddar vänner…</div>}
      {friends && friends.length === 0 && (
        <div style={{ color: T.muted, fontSize: "0.85rem" }}>
          Inga vänner att utmana — testa slumpa istället.
        </div>
      )}
      {friends && friends.length > 0 && (
        <div style={styles.list}>
          {friends.map((f) => (
            <div key={f.friendshipId} style={styles.row}>
              <span>{f.friendName}</span>
              <button
                onClick={() => handleFriend(f.friendId, f.friendName)}
                disabled={busyId !== null}
                style={styles.smallButton}
              >
                {busyId === f.friendId ? "Utmanar…" : "Utmana"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={onSkip} disabled={busyId !== null} style={styles.skipButton}>Hoppa över</button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.8rem", textAlign: "center",
  },
  score: { fontSize: "2.2rem", fontWeight: 700, color: T.accent },
  error: { color: T.accent2, fontSize: "0.85rem" },
  randomButton: {
    marginTop: "0.5rem", padding: "0.8rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer", width: "100%", maxWidth: 320,
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  smallButton: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
  },
  skipButton: {
    marginTop: "0.5rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.9rem", cursor: "pointer",
  },
};
