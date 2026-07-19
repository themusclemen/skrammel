import { useState } from "react";
import { T } from "../theme.js";

// Spoilerfri delningstext (likt Wordle/NYT Spelling Bee) — poäng, nivå och
// antal ord, aldrig vilka ord som faktiskt hittades.
function buildShareText(date, score, wordCount, todayLevel) {
  const lines = [`Skrammel ${date}`, `🎯 ${score} poäng · ${wordCount} ord`];
  if (todayLevel) lines.push(`🏆 Nivå: ${todayLevel}`);
  lines.push(window.location.origin);
  return lines.join("\n");
}

export default function ResultScreen({ score, words, todayLevel, date, user, streak, bestLevel, onPlayHome, onLeaderboard, onLogin }) {
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText(date, score, words.length, todayLevel);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // Avbruten delning (t.ex. användaren stängde dialogen) — inget att göra.
      }
      return;
    }
    await navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div style={styles.page}>
      <div style={{ color: T.muted }}>Tiden är ute!</div>
      <div style={styles.score}>{score} poäng</div>
      <div style={{ color: T.muted }}>{words.length} ord hittade</div>

      {user && (streak > 0 || bestLevel) && (
        <div style={styles.statsRow}>
          {streak > 0 && <span style={styles.statChip}>🔥 {streak} dagar i rad</span>}
          {bestLevel && <span style={styles.statChip}>🏆 Bästa nivå: {bestLevel}</span>}
        </div>
      )}

      <div style={styles.wordList}>
        {words.map((w) => (
          <div key={w} style={styles.wordChip}>{w}</div>
        ))}
      </div>

      <button onClick={handleShare} style={styles.shareButton}>
        {shareCopied ? "Kopierat!" : "Dela resultat"}
      </button>

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
  statsRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" },
  statChip: {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999,
    padding: "0.3rem 0.7rem", fontSize: "0.85rem", color: T.text,
  },
  wordList: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 320, justifyContent: "center" },
  wordChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.85rem" },
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
