import { T } from "../theme.js";

export default function HomeScreen({ user, displayName, onPlay, onLeaderboard, onLogin, onSignOut }) {
  return (
    <div style={styles.page}>
      <div style={styles.titleRow}>
        <span style={styles.sparkle}>✨</span>
        <h1 style={styles.title}>SKRAMMEL</h1>
        <span style={styles.sparkle}>✨</span>
      </div>
      <p style={styles.subtitle}>Hitta så många ord du kan på 5 minuter.</p>

      <div style={styles.playButtonBorder}>
        <button onClick={onPlay} style={styles.playButton}>Spela dagens skrammel</button>
      </div>
      <button onClick={onLeaderboard} style={styles.secondaryButton}>Topplista</button>

      <div style={styles.authRow}>
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
  titleRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" },
  title: {
    margin: 0, fontSize: "2.5rem", fontWeight: 800, letterSpacing: "0.06em",
    background: "linear-gradient(90deg, #b39ddb, #f2a6c9, #fdf1d6)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  sparkle: { fontSize: "1.6rem" },
  subtitle: { color: T.muted, margin: 0 },
  playButtonBorder: {
    marginTop: "0.5rem", padding: "3px", borderRadius: 12, width: "100%", maxWidth: 320,
    background: "linear-gradient(90deg, #b39ddb, #7ec8f2, #5fd0c4, #7bd88f, #f2a65a, #f26d6d)",
  },
  playButton: {
    display: "block", width: "100%",
    padding: "0.9rem 1.6rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  },
  secondaryButton: {
    padding: "0.7rem 1.4rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
  authRow: { marginTop: "2rem", fontSize: "0.85rem", color: T.muted },
};
