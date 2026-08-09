import { T } from "../theme.js";

// Kompakt genväg för spelare som kryssat "Visa inte denna text igen" på
// Solo-Hets förklaringsskärm (GameInfoScreen) — samma Starta/Tillbaka-val,
// men utan den fullständiga regeltexten. "Instruktioner" leder tillbaka dit.
export default function HetsQuickStartModal({ onStart, onBack, onInstructions }) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ margin: 0, color: T.accent }}>🔥 Solo-Hets</h2>
        <div style={styles.navRow}>
          <button onClick={onBack} style={styles.backButton}>Tillbaka</button>
          <button onClick={onStart} style={styles.startButton}>Starta</button>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); onInstructions(); }} style={styles.link}>
          Instruktioner
        </a>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
  },
  card: {
    width: "100%", maxWidth: 320, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.5rem", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "1rem", textAlign: "center",
  },
  navRow: { display: "flex", gap: "0.6rem", width: "100%" },
  backButton: {
    flex: 1, padding: "0.8rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontWeight: 600, fontSize: "1rem", cursor: "pointer",
  },
  startButton: {
    flex: 1, padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  link: { color: T.muted, fontSize: "0.85rem", textDecoration: "underline" },
};
