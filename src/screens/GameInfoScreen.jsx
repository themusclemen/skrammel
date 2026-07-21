import { T } from "../theme.js";

// Mellansteg mellan hemskärmens spela-knappar och själva spelflödet —
// förklarar vad spelet går ut på (och för Blixt/Skrammelpaj: vem man
// spelar mot) INNAN man committar till att starta, med ett tydligt
// Tillbaka/Starta-val. secondaryAction (t.ex. "Kalender" för Skrammel, som
// tar en till arkivet över tidigare dagar) renderas som en tonad extra-
// knapp under huvudvalet, ospårat av vare sig Blixt eller Skrammelpaj.
export default function GameInfoScreen({ title, description, onBack, onStart, startLabel = "Starta", secondaryAction }) {
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
        <button onClick={onStart} style={styles.startButton}>{startLabel}</button>
      </div>

      {secondaryAction && (
        <button onClick={secondaryAction.onClick} style={styles.secondaryButton}>
          {secondaryAction.label}
        </button>
      )}
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
  secondaryButton: {
    width: "100%", maxWidth: 380, padding: "0.7rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
  },
};
