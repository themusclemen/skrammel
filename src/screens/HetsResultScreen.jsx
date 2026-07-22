import { T } from "../theme.js";
import { useShare } from "../hooks/useShare.js";

function buildShareText(highestCompletedLength, totalTimeMs) {
  const seconds = (totalTimeMs / 1000).toFixed(1);
  return [
    "Hets",
    `🔥 ${highestCompletedLength} bokstäver på ${seconds} sekunder`,
    window.location.origin,
  ].join("\n");
}

// Samma "är det nya resultatet bättre?"-logik som submitHetsScore i
// src/api/hets.js — måste hållas i synk, annars kan den här skärmen fira
// ett "rekord" som aldrig faktiskt sparas (eller tvärtom).
function isNewRecord(highestCompletedLength, totalTimeMs, previousBest) {
  if (highestCompletedLength <= 0) return false;
  if (!previousBest) return true;
  return (
    highestCompletedLength > previousBest.best_length ||
    (highestCompletedLength === previousBest.best_length && totalTimeMs < previousBest.best_time_ms)
  );
}

export default function HetsResultScreen({
  highestCompletedLength, totalTimeMs, revealWord, previousBest, user, onPlayAgain, onLeaderboard, onHome, onLogin,
}) {
  const { share, copied } = useShare();
  const seconds = (totalTimeMs / 1000).toFixed(1);
  const newRecord = user && isNewRecord(highestCompletedLength, totalTimeMs, previousBest);

  return (
    <div style={styles.page}>
      <div style={{ color: T.muted }}>Tiden är ute!</div>
      <div style={styles.score}>{highestCompletedLength} bokstäver</div>
      <div style={{ color: T.muted }}>{seconds} sekunder totalt</div>

      {newRecord && <div style={styles.recordBadge}>🔥 Nytt rekord!</div>}
      {user && !newRecord && previousBest && (
        <div style={styles.statChip}>🏆 Ditt rekord: {previousBest.best_length} bokstäver</div>
      )}

      {revealWord && (
        <div style={styles.reveal}>Ett möjligt ord var: <strong>{revealWord}</strong></div>
      )}

      <button onClick={() => share(buildShareText(highestCompletedLength, totalTimeMs))} style={styles.shareButton}>
        {copied ? "Kopierat!" : "Dela resultat"}
      </button>

      {!user && (
        <button onClick={onLogin} style={styles.loginButton}>
          Logga in för att synas på topplistan
        </button>
      )}

      <div style={styles.navRow}>
        <button onClick={onPlayAgain} style={styles.navButton}>Spela igen</button>
        <button onClick={onLeaderboard} style={styles.navButton}>Topplista för Hets</button>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
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
  recordBadge: {
    background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 999,
    padding: "0.35rem 0.8rem", fontSize: "0.95rem", fontWeight: 700, color: T.accent,
  },
  statChip: {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999,
    padding: "0.3rem 0.7rem", fontSize: "0.85rem", color: T.text,
  },
  reveal: { color: T.muted, fontSize: "0.9rem" },
  shareButton: {
    marginTop: "0.5rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer",
  },
  loginButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
