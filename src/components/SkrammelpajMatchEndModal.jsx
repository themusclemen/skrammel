import { T } from "../theme.js";

// Pedagogisk förklaring av VARFÖR matchen tog slut — täcker både egna
// nederlag (tiden gick ut, poolen redan tom) och egna/motståndarens
// avgörande drag samt övergivande. Ersätter gamla SkrammelpajLossModal, som
// bara täckte de självrapporterade nederlagen.
const REASON_MESSAGES = {
  no_words_left: {
    won: (name) => `Ditt ord tömde poolen helt — ${name} har inga bokstäver kvar att bilda ord av. Du vann!`,
    lost: (name) => `Bokstäverna tog slut innan du hann bilda ett ord. Poolen var redan tom när din tur började, så matchen gick till ${name}.`,
  },
  timeout: {
    won: (name) => `${name} hann inte bilda ett ord innan tiden tog slut. Du vann!`,
    lost: () => "Tiden tog slut — du hann inte bilda ett ord i tid.",
  },
  forfeit: {
    won: (name) => `${name} svarade inte inom 72 timmar, så matchen räknas som förlorad för ${name}. Du vann!`,
    lost: () => "Du svarade inte inom 72 timmar, så matchen räknades automatiskt som förlorad.",
  },
  give_up: {
    won: (name) => `${name} gav upp matchen. Du vann!`,
    lost: (name) => `Du gav upp matchen mot ${name}.`,
  },
};

function describeMatchEnd(reason, won, opponentName) {
  const variant = REASON_MESSAGES[reason]?.[won ? "won" : "lost"];
  return variant ? variant(opponentName) : "Matchen är slut.";
}

export default function SkrammelpajMatchEndModal({ won, reason, opponentName, onContinue }) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={{ ...styles.title, color: won ? T.accent : T.accent2 }}>
          {won ? "🔤 Du vann!" : "🔤 Du förlorade"}
        </div>
        <div style={styles.message}>{describeMatchEnd(reason, won, opponentName)}</div>
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
    width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.4rem", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "0.7rem", textAlign: "center",
  },
  title: { fontSize: "1.3rem", fontWeight: 800 },
  message: { fontSize: "1rem", color: T.text, lineHeight: 1.5 },
  continueButton: {
    width: "100%", padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
    marginTop: "0.3rem",
  },
};
