import { T } from "../theme.js";

// Mellansteg mellan hemskärmens spela-knappar och själva spelflödet för
// Blixt/Skrammelpaj — förklarar vad spelet går ut på och vem man spelar
// mot INNAN man committar till att starta, med ett tydligt Tillbaka/Starta-
// val. Dagens Skrammel har inget motsvarande steg (samma spel varje dag,
// redan självförklarande).
export default function GameInfoScreen({ title, description, onBack, onStart }) {
  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>{title}</h2>

      <div style={styles.description}>
        {description.map((paragraph, i) => (
          <p key={i} style={styles.paragraph}>{paragraph}</p>
        ))}
      </div>

      <div style={styles.navRow}>
        <button onClick={onBack} style={styles.backButton}>Tillbaka</button>
        <button onClick={onStart} style={styles.startButton}>Starta</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1.2rem", padding: "1.5rem", textAlign: "center",
  },
  description: { display: "flex", flexDirection: "column", gap: "0.7rem", maxWidth: 380 },
  paragraph: { margin: 0, color: T.text, fontSize: "1rem", lineHeight: 1.5 },
  navRow: { display: "flex", gap: "0.6rem", width: "100%", maxWidth: 380, marginTop: "0.5rem" },
  backButton: {
    flex: 1, padding: "0.8rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontWeight: 600, fontSize: "1rem", cursor: "pointer",
  },
  startButton: {
    flex: 1, padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
};
