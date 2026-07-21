import { T } from "../theme.js";

const REASON_MESSAGES = {
  timeout: "Tiden tog slut — du hann inte bilda ett ord i tid.",
  no_words_left: "Inga fler ord går att bilda av de kvarvarande bokstäverna.",
};

// Skrammelpajs motsvarighet till BlixtTimeUpModal — men till skillnad från
// Blixt (där tidsslut bara avgör vem som vann/förlorade av två redan spelade
// resultat) betyder det HÄR alltid ett direkt nederlag, så det finns bara
// ett utfall att visa.
export default function SkrammelpajLossModal({ reason, onContinue }) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>🥧 Du förlorade</div>
        <div style={styles.message}>{REASON_MESSAGES[reason] ?? "Matchen är slut."}</div>
        <button onClick={onContinue} style={styles.continueButton}>Fortsätt</button>
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
  title: { fontSize: "1.3rem", fontWeight: 800, color: T.accent2 },
  message: { fontSize: "1rem", color: T.text, lineHeight: 1.5 },
  continueButton: {
    width: "100%", padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
    marginTop: "0.3rem",
  },
};
