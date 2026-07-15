import { T } from "../theme.js";

export default function ResultScreen({ score, words, user, onPlayHome, onLeaderboard, onLogin }) {
  return (
    <div style={styles.page}>
      <div style={{ color: T.muted }}>Tiden är ute!</div>
      <div style={styles.score}>{score} poäng</div>
      <div style={{ color: T.muted }}>{words.length} ord hittade</div>

      <div style={styles.wordList}>
        {words.map((w) => (
          <div key={w} style={styles.wordChip}>{w}</div>
        ))}
      </div>

      {!user && (
        <button onClick={onLogin} style={styles.loginButton}>
          Logga in för att synas på topplistan
        </button>
      )}

      <div style={styles.navRow}>
        <button onClick={onLeaderboard} style={styles.navButton}>Topplista</button>
        <button onClick={onPlayHome} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1rem", padding: "1.5rem", textAlign: "center",
  },
  score: { fontSize: "3rem", fontWeight: 700, color: T.accent },
  wordList: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 320, justifyContent: "center" },
  wordChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.85rem" },
  loginButton: {
    marginTop: "1rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
