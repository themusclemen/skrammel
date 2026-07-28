import { T } from "../theme.js";

// Global navigering, ovanpå alla skärmar utom själva speltiden (se
// GAMEPLAY_SCREENS i App.jsx) — där ska "..."-menyns egen avsluta-
// bekräftelse vara enda vägen ut, annars kan man råka hoppa hem mitt i
// en tidsbestämd runda utan att bekräfta.
export default function TopNavIcons({ user, onHome, onSettings }) {
  return (
    <div style={styles.bar}>
      <button onClick={onHome} style={styles.iconButton} aria-label="Till startsidan">🏠</button>
      {user && (
        <button onClick={onSettings} style={{ ...styles.iconButton, ...styles.right }} aria-label="Inställningar">⚙️</button>
      )}
    </div>
  );
}

const styles = {
  bar: { position: "fixed", inset: 0, height: 0, zIndex: 30, pointerEvents: "none" },
  iconButton: {
    position: "fixed", top: "0.8rem", left: "0.8rem",
    width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "1.15rem", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", pointerEvents: "auto",
  },
  right: { left: "auto", right: "0.8rem" },
};
