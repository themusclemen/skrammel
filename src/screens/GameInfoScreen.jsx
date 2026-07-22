import { useState } from "react";
import { T } from "../theme.js";

// Samma ordlista (public/ordlista.txt) delas av alla tre spelen, så
// texten om vilka ord som gäller hör hemma här snarare än i varje
// enskild description-prop. Se "Ordlista" i architecture.md för källan.
const WORD_LIST_NOTE =
  "Ordlistan har drygt 70 000 svenska ord, plus vanliga böjningar (plural, bestämd form osv). Genitiv-s (t.ex. \"husets\") är sällan med, och namn räknas inte som ord.";

// Mellansteg mellan hemskärmens spela-knappar och själva spelflödet —
// förklarar vad spelet går ut på (och för Blixt/Skrammelpaj: vem man
// spelar mot) INNAN man committar till att starta, med ett tydligt
// Tillbaka/Starta-val. secondaryAction (t.ex. "Kalender" för Skrammel, som
// tar en till arkivet över tidigare dagar) renderas som en tonad extra-
// knapp under huvudvalet, ospårat av vare sig Blixt eller Skrammelpaj.
export default function GameInfoScreen({ title, description, onBack, onStart, startLabel = "Starta", secondaryAction }) {
  const [showWordListNote, setShowWordListNote] = useState(false);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>{title}</h2>

      <div style={styles.description}>
        {description.map((paragraph, i) => (
          <p key={i} style={styles.paragraph}>{paragraph}</p>
        ))}
      </div>

      <button
        onClick={() => setShowWordListNote((v) => !v)}
        style={styles.wordListToggle}
      >
        {showWordListNote ? "Vilka ord gäller? ▲" : "Vilka ord gäller? ▼"}
      </button>
      {showWordListNote && <p style={styles.wordListNote}>{WORD_LIST_NOTE}</p>}

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
  wordListToggle: {
    background: "none", border: "none", color: T.muted, fontSize: "0.85rem",
    fontWeight: 600, cursor: "pointer", padding: 0, marginTop: "-0.4rem",
  },
  wordListNote: { margin: 0, maxWidth: 380, color: T.muted, fontSize: "0.85rem", lineHeight: 1.5 },
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
