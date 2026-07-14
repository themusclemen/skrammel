import { T } from "../theme.js";

// Visas när spelaren väljer ett redan klarat datum i arkivet — påminner om
// att en repris inte räknas till topplistan innan de bekräftar.
export default function ReplayConfirmModal({ onConfirm, onCancel }) {
  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>Redan spelad</div>
        <div style={styles.text}>
          Du har redan spelat den här dagen. Spelar du igen räknas det inte till
          topplistan — du kör utom tävling.
        </div>
        <button onClick={onConfirm} style={styles.confirmButton}>Spela utom tävling</button>
        <button onClick={onCancel} style={styles.cancelButton}>Avbryt</button>
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
    width: "100%", maxWidth: 320, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem",
  },
  title: { fontSize: "1.1rem", fontWeight: 800, color: T.text, textAlign: "center" },
  text: { color: T.muted, fontSize: "0.9rem", textAlign: "center", padding: "0 0.2rem 0.2rem" },
  confirmButton: {
    padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  cancelButton: {
    padding: "0.8rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
};
