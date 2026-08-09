import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchFriends } from "../api/friends.js";

// Visas när man trycker "Starta ny match" på Blixt-hubben (BlixtScreen).
// Motståndaren väljs HÄR, innan rundan spelas — till skillnad från det
// gamla flödet där man spelade en oriktad runda och valde mottagare
// efteråt (se App.jsx startBlixtRound). CPU är ren träning och fungerar
// även när spelaren ligger i 20-matcherstaket (atCap), till skillnad från
// vän/slump som båda skapar en riktig utmaningsrad.
export default function BlixtNewMatchModal({ userId, atCap, onChallengeFriend, onChallengeRandom, onPlayCpu, onClose }) {
  const [view, setView] = useState("menu"); // "menu" | "friends"
  const [friends, setFriends] = useState(null);

  useEffect(() => {
    if (view === "friends" && friends === null) {
      fetchFriends(userId).then(setFriends).catch(() => setFriends([]));
    }
  }, [view, friends, userId]);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        {view === "menu" ? (
          <>
            <div style={styles.title}>Starta ny match</div>

            <button
              onClick={() => setView("friends")}
              disabled={atCap}
              style={{ ...styles.optionButton, opacity: atCap ? 0.5 : 1 }}
            >
              👥 Utmana en vän
            </button>
            <button
              onClick={onChallengeRandom}
              disabled={atCap}
              style={{ ...styles.optionButton, opacity: atCap ? 0.5 : 1 }}
            >
              🎲 Slumpmässig motståndare
            </button>
            {atCap && (
              <div style={styles.capNote}>Max antal matcher nått — men CPU går alltid bra.</div>
            )}
            <button onClick={onPlayCpu} style={styles.optionButton}>🤖 Spela mot CPU</button>

            <button onClick={onClose} style={styles.cancelButton}>Avbryt</button>
          </>
        ) : (
          <>
            <div style={styles.title}>Utmana en vän</div>

            {friends === null && <div style={{ color: T.muted }}>Laddar vänner…</div>}
            {friends && friends.length === 0 && (
              <div style={{ color: T.muted, fontSize: "0.85rem" }}>
                Inga vänner att utmana — testa slumpa istället.
              </div>
            )}
            {friends && friends.length > 0 && (
              <div style={styles.list}>
                {friends.map((f) => (
                  <button
                    key={f.friendshipId}
                    onClick={() => onChallengeFriend(f.friendId, f.friendName)}
                    style={styles.friendRow}
                  >
                    {f.friendName}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => setView("menu")} style={styles.cancelButton}>Tillbaka</button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem",
  },
  card: {
    width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem",
  },
  title: { fontSize: "1.1rem", fontWeight: 800, color: T.text, textAlign: "center", marginBottom: "0.2rem" },
  optionButton: {
    padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
  },
  capNote: { color: T.muted, fontSize: "0.78rem", textAlign: "center", margin: "-0.2rem 0 0" },
  cancelButton: {
    marginTop: "0.4rem", padding: "0.7rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "40vh", overflowY: "auto" },
  friendRow: {
    padding: "0.7rem 0.9rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.text, fontSize: "0.95rem", cursor: "pointer", textAlign: "left",
  },
};
