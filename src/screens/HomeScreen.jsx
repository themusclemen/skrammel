import { T } from "../theme.js";

export default function HomeScreen({ user, displayName, onPlay, onLeaderboard, onLogin, onSignOut }) {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>SKRAMMEL</h1>
      <p style={{ color: T.muted }}>Hitta så många ord du kan på 5 minuter.</p>

      <button onClick={onPlay} style={styles.primaryButton}>Spela dagens skrammel</button>
      <button onClick={onLeaderboard} style={styles.secondaryButton}>Topplista</button>

      <div style={{ marginTop: "2rem", fontSize: "0.85rem", color: T.muted }}>
        {user ? (
          <>
            Inloggad som {displayName ?? user.email}
            {" · "}
            <a href="#" onClick={(e) => { e.preventDefault(); onSignOut(); }} style={{ color: T.muted }}>
              Logga ut
            </a>
          </>
        ) : (
          <a href="#" onClick={(e) => { e.preventDefault(); onLogin(); }} style={{ color: T.accent }}>
            Logga in för att synas på topplistan
          </a>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: T.bg,
    color: T.text,
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "1.5rem",
    textAlign: "center",
  },
  title: { fontSize: "2.5rem", letterSpacing: "0.05em", color: T.accent, margin: 0 },
  primaryButton: {
    padding: "0.9rem 1.6rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  secondaryButton: {
    padding: "0.7rem 1.4rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
