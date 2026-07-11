import { T } from "../theme.js";

// Visas när man trycker på ett av de små ordlängd-pillren — listar orden
// spelaren hittat på just den längden.
export default function WordLengthModal({ length, words, total, onClose }) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>{length} bokstäver</span>
          <button onClick={onClose} style={styles.closeButton} aria-label="Stäng">×</button>
        </div>
        <div style={styles.subtitle}>{words.length} av {total} hittade</div>

        {words.length === 0 ? (
          <div style={styles.empty}>Inga ord hittade än på den här längden.</div>
        ) : (
          <div style={styles.list}>
            {words.map((w) => (
              <div key={w.word} style={styles.chip}>
                {w.word} <span style={{ color: T.accent }}>+{w.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem",
  },
  card: {
    width: "100%", maxWidth: 360, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.2rem",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: "1.2rem", fontWeight: 800, color: T.text },
  closeButton: {
    background: "none", border: "none", color: T.muted, fontSize: "1.4rem", cursor: "pointer",
    lineHeight: 1, padding: "0.2rem 0.4rem",
  },
  subtitle: { color: T.muted, fontSize: "0.85rem", marginTop: "0.3rem", marginBottom: "1rem" },
  empty: { color: T.muted, fontSize: "0.9rem", textAlign: "center", padding: "1rem 0" },
  list: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  chip: {
    background: T.tile, border: `1px solid ${T.tileBorder}`, color: T.tileText,
    borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.9rem", fontWeight: 700,
  },
};
