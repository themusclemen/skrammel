import { T } from "../theme.js";

export default function GameMenuModal({ onQuit, onResume }) {
  return (
    <div style={styles.backdrop} onClick={onResume}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button onClick={onQuit} style={styles.quitButton}>Avsluta</button>
        <button onClick={onResume} style={styles.resumeButton}>Fortsätt</button>
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
    borderRadius: 16, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem",
  },
  quitButton: {
    padding: "0.8rem", borderRadius: 10, border: `1px solid ${T.accent2}`,
    background: "transparent", color: T.accent2, fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  resumeButton: {
    padding: "0.8rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
};
