import { T } from "../theme.js";

// Visas direkt när tiden tar slut i en Blixt-runda — innan facit. Om
// targetScore är satt (spelaren svarar på en utmaning) vet vi motståndarens
// poäng redan och kan visa vann/förlorade direkt; annars (ny blixt, ingen
// motståndare än) visas bara att rundan är klar.
export default function BlixtTimeUpModal({ score, wordCount, targetScore, opponentName, onContinue }) {
  const hasOpponent = targetScore != null;
  const verdict = hasOpponent
    ? score > targetScore ? "Du vann!" : score < targetScore ? "Du förlorade" : "Oavgjort"
    : null;
  const verdictColor = hasOpponent
    ? score > targetScore ? T.accent : score < targetScore ? T.accent2 : T.muted
    : null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>⏱ Tiden är ute!</div>

        {hasOpponent ? (
          <>
            <div style={{ ...styles.verdict, color: verdictColor }}>{verdict}</div>
            <div style={styles.scoreRow}>
              <div style={styles.scoreBlock}>
                <div style={styles.scoreLabel}>Du</div>
                <div style={styles.scoreValue}>{score}</div>
              </div>
              <div style={styles.scoreDivider}>–</div>
              <div style={styles.scoreBlock}>
                <div style={styles.scoreLabel}>{opponentName}</div>
                <div style={styles.scoreValue}>{targetScore}</div>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.summary}>{wordCount} ord · {score} poäng</div>
        )}

        <button onClick={onContinue} style={styles.continueButton}>
          Se facit
        </button>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.7)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "1.5rem",
  },
  card: {
    width: "100%", maxWidth: 320, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.4rem", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "0.7rem", textAlign: "center",
  },
  title: { fontSize: "1.3rem", fontWeight: 800, color: T.text },
  verdict: { fontSize: "1.5rem", fontWeight: 800 },
  summary: { fontSize: "1.3rem", fontWeight: 700, color: T.accent, marginBottom: "0.3rem" },
  scoreRow: { display: "flex", alignItems: "center", gap: "1rem" },
  scoreBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" },
  scoreLabel: { color: T.muted, fontSize: "0.8rem" },
  scoreValue: { fontSize: "1.6rem", fontWeight: 700, color: T.text },
  scoreDivider: { color: T.muted, fontSize: "1.3rem" },
  continueButton: {
    width: "100%", padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
    marginTop: "0.3rem",
  },
};
