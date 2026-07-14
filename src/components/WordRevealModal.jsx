import { T } from "../theme.js";

// Visas efter att spelaren bekräftat att den vill avsluta mitt i spelet —
// facit över alla ord som gick att bilda av källordet, grupperade per
// längd. Ord spelaren redan hittat är markerade, resten avslöjas.
export default function WordRevealModal({ wordsByLength, foundWords, onContinue }) {
  const lengths = Object.keys(wordsByLength).map(Number).sort((a, b) => a - b);

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>Alla ord</div>

        <div style={styles.scroll}>
          {lengths.map((length) => (
            <div key={length} style={styles.section}>
              <div style={styles.sectionLabel}>{length} bokstäver</div>
              <div style={styles.list}>
                {wordsByLength[length].map((word) => {
                  const found = foundWords.has(word);
                  return (
                    <div key={word} style={{ ...styles.chip, ...(found ? styles.chipFound : styles.chipMissed) }}>
                      {word}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onContinue} style={styles.continueButton}>
          Till resultat
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
    width: "100%", maxWidth: 420, maxHeight: "80vh", background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.8rem",
  },
  title: { fontSize: "1.2rem", fontWeight: 800, color: T.text, textAlign: "center", flexShrink: 0 },
  scroll: { overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.8rem" },
  section: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  sectionLabel: { color: T.muted, fontSize: "0.8rem", fontWeight: 700 },
  list: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  chip: {
    borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.9rem", fontWeight: 700, border: "1px solid",
  },
  chipFound: {
    background: T.tile, borderColor: T.tileBorder, color: T.tileText,
  },
  chipMissed: {
    background: "transparent", borderColor: T.border, color: T.muted,
  },
  continueButton: {
    flexShrink: 0, padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
};
