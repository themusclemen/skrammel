import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchLeaderboard, fetchFriendsLeaderboard } from "../api/skrammelpaj.js";

export default function SkrammelpajLeaderboardScreen({ user, onBack, onChallenge }) {
  const [scope, setScope] = useState("global"); // "global" | "friends"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    const load = scope === "friends" && user ? fetchFriendsLeaderboard(user.id) : fetchLeaderboard();
    load.then(setRows).catch((err) => setError(err.message));
  }, [scope, user]);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>🔤 Topplista för Bokstavs-Duell</h2>
      <div style={{ color: T.muted, fontSize: "0.85rem" }}>Rankat efter flest vunna matcher</div>

      {user && (
        <div style={styles.scopeRow}>
          <button
            onClick={() => setScope("global")}
            style={{ ...styles.scopeButton, ...(scope === "global" ? styles.scopeButtonActive : null) }}
          >
            Global
          </button>
          <button
            onClick={() => setScope("friends")}
            style={{ ...styles.scopeButton, ...(scope === "friends" ? styles.scopeButtonActive : null) }}
          >
            Vänner
          </button>
        </div>
      )}

      {error && <div style={{ color: T.muted }}>Topplistan är inte redo än.</div>}
      {!error && rows === null && <div style={{ color: T.muted }}>Laddar…</div>}
      {rows && rows.length === 0 && (
        <div style={{ color: T.muted }}>
          {scope === "friends" ? "Ingen av dina vänner har spelat en Bokstavs-Duell än." : "Ingen har spelat en Bokstavs-Duell än."}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={styles.list}>
          {rows.map((row, i) => (
            <div key={row.user_id} style={styles.row}>
              <span>#{i + 1} {row.display_name}</span>
              <div style={styles.rowRight}>
                <span style={styles.record}>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{row.wins}V</span>
                  {" – "}
                  <span style={{ color: T.muted }}>{row.losses}F</span>
                </span>
                {user && row.user_id !== user.id && (
                  <button onClick={() => onChallenge(row.user_id, row.display_name)} style={styles.challengeButton}>
                    Utmana
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.navRow}>
        <button onClick={onBack} style={styles.navButton}>Till Bokstavs-Duell</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.8rem", textAlign: "center",
  },
  scopeRow: { display: "flex", gap: "0.4rem" },
  scopeButton: {
    padding: "0.4rem 0.9rem", borderRadius: 999, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.85rem", cursor: "pointer",
  },
  scopeButtonActive: { background: T.accent, borderColor: T.accent, color: "#121212", fontWeight: 700 },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  rowRight: { display: "flex", alignItems: "center", gap: "0.6rem" },
  record: { fontSize: "0.9rem" },
  challengeButton: {
    padding: "0.35rem 0.6rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
