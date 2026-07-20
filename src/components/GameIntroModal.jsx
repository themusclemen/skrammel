import { T } from "../theme.js";

// Visas innan klockan börjar ticka — förklarar reglerna för den aktuella
// rundan (dagens ord, ny blixt, eller svara på en blixtutmaning) så
// spelaren vet vad som gäller innan tiden startar.
export default function GameIntroModal({ title, message, onStart }) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>{title}</div>
        <div style={styles.message}>{message}</div>
        <button onClick={onStart} style={styles.startButton}>Nu kör vi!</button>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: "1.5rem",
  },
  card: {
    width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.6rem 1.4rem", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "0.9rem", textAlign: "center",
  },
  title: { fontSize: "1.3rem", fontWeight: 800, color: T.text },
  message: { fontSize: "1rem", color: T.text, lineHeight: 1.5 },
  startButton: {
    width: "100%", padding: "0.9rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1.05rem", cursor: "pointer",
    marginTop: "0.3rem",
  },
};
