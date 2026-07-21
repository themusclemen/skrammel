import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchFriends } from "../api/friends.js";

// Till skillnad från Blixt (spela-först, välj-motståndare-sen) väljs
// motståndaren HÄR, innan något skapas — Skrammelpaj har ingen oberoende
// solorunda att spela i förväg eftersom hela poängen är en delad pool
// mellan två specifika spelare. onChallengeFriend/onChallengeRandom skapar
// utmaningen (App.jsx) och kan avvisas av RLS (mottagarens 20-tak nått).
export default function SkrammelpajChooseOpponentScreen({
  user, presetOpponent, onChallengeFriend, onChallengeRandom, onPlayCpu, onBack,
}) {
  const [friends, setFriends] = useState(null);
  const [busyId, setBusyId] = useState(null); // "random", "preset" eller ett friendId
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

  const handlePreset = async () => {
    setBusyId("preset");
    setError(null);
    try {
      await onChallengeFriend(presetOpponent.id, presetOpponent.name);
    } catch {
      setError(`${presetOpponent.name} har redan för många pågående matcher.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>🥧 Starta en Skrammelpaj</h2>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>Vem vill du utmana?</div>

      {error && <div style={styles.error}>{error}</div>}

      {presetOpponent && (
        <button onClick={handlePreset} disabled={busyId !== null} style={styles.presetButton}>
          {busyId === "preset" ? "Utmanar…" : `🥧 Utmana ${presetOpponent.name}`}
        </button>
      )}

      <button onClick={handleRandom} disabled={busyId !== null} style={styles.randomButton}>
        {busyId === "random" ? "Slumpar…" : "🎲 Slumpa motståndare"}
      </button>

      <button onClick={onPlayCpu} disabled={busyId !== null} style={styles.cpuButton}>
        🤖 Spela mot CPU (räknas inte till topplistan)
      </button>

      {friends === null && <div style={{ color: T.muted }}>Laddar vänner…</div>}
      {friends && friends.length === 0 && (
        <div style={{ color: T.muted, fontSize: "0.85rem" }}>
          Inga vänner att utmana — testa slumpa eller CPU istället.
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

      <button onClick={onBack} disabled={busyId !== null} style={styles.skipButton}>Avbryt</button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.8rem", textAlign: "center",
  },
  error: { color: T.accent2, fontSize: "0.85rem" },
  presetButton: {
    padding: "0.8rem 1.2rem", borderRadius: 10, border: `2px solid ${T.accent}`,
    background: "transparent", color: T.accent, fontWeight: 700, cursor: "pointer", width: "100%", maxWidth: 320,
  },
  randomButton: {
    marginTop: "0.5rem", padding: "0.8rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer", width: "100%", maxWidth: 320,
  },
  cpuButton: {
    padding: "0.8rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontWeight: 600, cursor: "pointer", width: "100%", maxWidth: 320,
    fontSize: "0.9rem",
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
