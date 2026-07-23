import { T } from "../theme.js";
import { describeEndReason } from "../api/skrammelpaj.js";

// Visas direkt efter ett eget avgörande drag i en async-match — vinst
// (motståndarens pool tömd), eller förlust (tiden gick ut, inget ord gick
// att bilda, eller man gav upp). Motsvarar BlixtResultScreen, men jämför
// inte poäng — visar draghistoriken istället.
export default function SkrammelpajResultScreen({ won, endReason, opponentName, moves, userId, onHome, onSkrammelpaj }) {
  const reasonText = describeEndReason(endReason, won, opponentName);

  return (
    <div style={styles.page}>
      <div style={{ color: T.muted }}>Bokstavs-Duell mot {opponentName}</div>
      <div style={{ ...styles.verdict, color: won ? T.accent : T.accent2 }}>{won ? "Du vann!" : "Du förlorade"}</div>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>{reasonText}</div>

      {moves.length > 0 && (
        <div style={styles.moveList}>
          {moves.map((m) => (
            <span key={m.id ?? `${m.user_id}-${m.word}`} style={{ ...styles.moveChip, ...(m.user_id === userId ? styles.moveChipMine : null) }}>
              {m.user_id === userId ? "Du" : opponentName}: {m.word}
            </span>
          ))}
        </div>
      )}

      <div style={styles.navRow}>
        <button onClick={onSkrammelpaj} style={styles.navButton}>Till Bokstavs-Duell</button>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1rem", padding: "1.5rem", textAlign: "center",
  },
  verdict: { fontSize: "1.8rem", fontWeight: 800 },
  moveList: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 360, justifyContent: "center" },
  moveChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.85rem", color: T.muted },
  moveChipMine: { borderColor: T.accent, color: T.accent },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
