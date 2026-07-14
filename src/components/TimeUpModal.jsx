import { T } from "../theme.js";

// Visas när tiden tar slut. Ingen backdrop-stängning — spelaren måste
// aktivt välja Fortsätt eller Ge upp.
export default function TimeUpModal({ score, wordCount, onContinue, onQuit }) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>⏱ Tiden är ute!</div>
        <div style={styles.summary}>{wordCount} ord · {score} poäng</div>

        <button onClick={onContinue} style={styles.continueButton}>
          Fortsätt (utan tävling)
        </button>
        <button onClick={onQuit} style={styles.quitButton}>
          Ge upp
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
  summary: { fontSize: "1.3rem", fontWeight: 700, color: T.accent, marginBottom: "0.3rem" },
  continueButton: {
    width: "100%", padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  quitButton: {
    width: "100%", padding: "0.8rem", borderRadius: 10, border: `1px solid ${T.accent2}`,
    background: "transparent", color: T.accent2, fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
};
