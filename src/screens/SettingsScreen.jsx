import { T } from "../theme.js";

// Skal för administrationssidan (kugghjulet) — innehållet är inte
// utformat än, bara platshållare för det som ska hit: byta visningsnamn,
// byta lösenord, statistik m.m.
export default function SettingsScreen({ user, displayName, onBack }) {
  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>Inställningar</h2>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>
        Inloggad som {displayName ?? user.email}
      </div>

      <div style={styles.list}>
        <div style={styles.row}>
          <span>Byt visningsnamn</span>
          <span style={styles.soon}>Kommer snart</span>
        </div>
        <div style={styles.row}>
          <span>Byt lösenord</span>
          <span style={styles.soon}>Kommer snart</span>
        </div>
        <div style={styles.row}>
          <span>Statistik</span>
          <span style={styles.soon}>Kommer snart</span>
        </div>
      </div>

      <button onClick={onBack} style={styles.navButton}>Till start</button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1rem", textAlign: "center",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 400 },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.7rem 0.9rem",
    background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
  },
  soon: { color: T.muted, fontSize: "0.8rem" },
  navButton: {
    marginTop: "0.5rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
