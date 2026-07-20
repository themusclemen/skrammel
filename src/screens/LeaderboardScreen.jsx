import { useEffect, useState } from "react";
import { T } from "../theme.js";
import { fetchLeaderboard } from "../api/scores.js";
import { fetchFriendsLeaderboard } from "../api/friends.js";

const MONTH_NAMES = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

function pad(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Dagräkning via lokala datumkomponenter, inte UTC — se motivering i App.jsx.
function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d);
  next.setDate(next.getDate() + delta);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export default function LeaderboardScreen({ date, onDateChange, onHome, onArchive, user }) {
  const [scope, setScope] = useState("global"); // "global" | "friends"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const today = todayStr();
  const isToday = date === today;

  useEffect(() => {
    setRows(null);
    setError(null);
    const load = scope === "friends" && user ? fetchFriendsLeaderboard(date, user.id) : fetchLeaderboard(date);
    load.then(setRows).catch((err) => setError(err.message));
  }, [date, scope, user]);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>Topplista för Dagens Skrammel</h2>

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

      <div style={styles.dateNav}>
        <button onClick={() => onDateChange(addDays(date, -1))} style={styles.dateNavButton}>‹</button>
        <div style={{ color: T.muted, minWidth: 140 }}>{formatDate(date)}</div>
        <button
          onClick={() => onDateChange(addDays(date, 1))}
          disabled={isToday}
          style={{ ...styles.dateNavButton, ...(isToday ? styles.dateNavButtonDisabled : null) }}
        >
          ›
        </button>
      </div>

      {error && <div style={{ color: T.muted }}>Topplistan är inte redo än.</div>}
      {!error && rows === null && <div style={{ color: T.muted }}>Laddar…</div>}
      {rows && rows.length === 0 && (
        <div style={{ color: T.muted }}>
          {isToday ? "Ingen har spelat idag än. Bli först!" : "Ingen spelade den här dagen."}
        </div>
      )}

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
        <button onClick={onArchive} style={styles.navButton}>Tidigare Dagens Skrammel</button>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1rem", textAlign: "center",
  },
  scopeRow: { display: "flex", gap: "0.4rem" },
  scopeButton: {
    padding: "0.4rem 0.9rem", borderRadius: 999, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.85rem", cursor: "pointer",
  },
  scopeButtonActive: { background: T.accent, borderColor: T.accent, color: "#121212", fontWeight: 700 },
  dateNav: { display: "flex", alignItems: "center", gap: "1rem", marginTop: "-0.5rem" },
  dateNavButton: {
    background: T.surface, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
    width: "2.2rem", height: "2.2rem", fontSize: "1.2rem", cursor: "pointer",
  },
  dateNavButtonDisabled: { color: T.muted, cursor: "default", opacity: 0.5 },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
