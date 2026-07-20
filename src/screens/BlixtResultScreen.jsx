import { T } from "../theme.js";

// Visas för opponenten direkt efter att de spelat klart en accepterad
// utmaning — creatorns poäng är redan känd vid det laget. Ordlistan får
// visas fritt, ingen spoilerhänsyn behövs eftersom rundan redan är avgjord.
export default function BlixtResultScreen({ myScore, myWords, opponentScore, opponentName, onHome, onBlixt }) {
  const verdict = myScore > opponentScore ? "Du vann!" : myScore < opponentScore ? "Du förlorade" : "Oavgjort";

  return (
    <div style={styles.page}>
      <div style={{ color: T.muted }}>Blixt mot {opponentName}</div>
      <div style={styles.verdict}>{verdict}</div>

      <div style={styles.scoreRow}>
        <div style={styles.scoreBlock}>
          <div style={styles.scoreLabel}>Du</div>
          <div style={styles.scoreValue}>{myScore}</div>
        </div>
        <div style={styles.scoreDivider}>–</div>
        <div style={styles.scoreBlock}>
          <div style={styles.scoreLabel}>{opponentName}</div>
          <div style={styles.scoreValue}>{opponentScore}</div>
        </div>
      </div>

      <div style={styles.wordList}>
        {myWords.map((w) => (
          <div key={w} style={styles.wordChip}>{w}</div>
        ))}
      </div>

      <div style={styles.navRow}>
        <button onClick={onBlixt} style={styles.navButton}>Till Blixt</button>
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
  verdict: { fontSize: "1.8rem", fontWeight: 800, color: T.accent },
  scoreRow: { display: "flex", alignItems: "center", gap: "1rem" },
  scoreBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" },
  scoreLabel: { color: T.muted, fontSize: "0.85rem" },
  scoreValue: { fontSize: "2rem", fontWeight: 700 },
  scoreDivider: { color: T.muted, fontSize: "1.5rem" },
  wordList: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 320, justifyContent: "center" },
  wordChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.85rem" },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
