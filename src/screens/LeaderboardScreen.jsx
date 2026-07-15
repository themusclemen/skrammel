import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchLeaderboard } from "../api/scores.js";

export default function LeaderboardScreen({ date, onHome, onArchive }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard(date).then(setRows).catch((err) => setError(err.message));
  }, [date]);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>Dagens topplista</h2>

      {error && <div style={{ color: T.muted }}>Topplistan är inte redo än.</div>}
      {!error && rows === null && <div style={{ color: T.muted }}>Laddar…</div>}
      {rows && rows.length === 0 && <div style={{ color: T.muted }}>Ingen har spelat idag än. Bli först!</div>}

      {rows && rows.length > 0 && (
        <div style={styles.list}>
          {rows.map((row, i) => (
            <div key={i} style={styles.row}>
              <span>#{i + 1} {row.display_name}</span>
              <span style={{ color: T.accent, fontWeight: 700 }}>{row.score}</span>
            </div>
          ))}
        </div>
      )}

      <div style={styles.navRow}>
        <button onClick={onArchive} style={styles.navButton}>Tidigare utmaningar</button>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
