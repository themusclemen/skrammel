import { T } from "../theme.js";

export default function HomeScreen({
  user, displayName, streak, bestLevel, playedToday = false,
  pendingBlixtCount = 0, pendingBlixtInviteCount = 0, blixtUpdatesCount = 0,
  pendingSkrammelpajCount = 0, pendingSkrammelpajInviteCount = 0, skrammelpajUpdatesCount = 0,
  onPlay, onPlayHets, onPlayBlixt, onPlaySkrammelpaj, onTopplistor, onFriends, onGoToBlixt, onGoToSkrammelpaj, onLogin, onSignOut,
}) {
  // Aktivitet på Blixt/Skrammelpaj visas genom att blinka på själva
  // spelknappen (samma mönster som "Dagens Skrammel") istället för en
  // separat notisbanner — mindre att läsa, tydligare vart man ska trycka.
  // Drag att göra vinner över nya utmaningar, som i sin tur vinner över
  // "uppdaterad". pendingBlixtCount/pendingSkrammelpajCount räknar bara
  // faktiska drag (your_turn) — inbjudningar som väntar på svar räknas
  // separat så aktiviteten inte blåses upp med matcher man inte ska spela
  // ett drag i.
  const blixtHasActivity = pendingBlixtCount > 0 || pendingBlixtInviteCount > 0 || blixtUpdatesCount > 0;
  const blixtNeedsMove = pendingBlixtCount > 0 || pendingBlixtInviteCount > 0;
  const skrammelpajHasActivity = pendingSkrammelpajCount > 0 || pendingSkrammelpajInviteCount > 0 || skrammelpajUpdatesCount > 0;
  const skrammelpajNeedsMove = pendingSkrammelpajCount > 0 || pendingSkrammelpajInviteCount > 0;

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes skrammelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      <div style={styles.titleRow}>
        <span style={styles.sparkle}>✨</span>
        <h1 style={styles.title}>SKRAMMEL</h1>
        <span style={styles.sparkle}>✨</span>
      </div>
      <p style={styles.subtitle}>Hitta orden i ordet!</p>

      {user && (streak > 0 || bestLevel) && (
        <div style={styles.statsRow}>
          {streak > 0 && <span style={styles.statChip}>🔥 {streak} dagar i rad</span>}
          {bestLevel && <span style={styles.statChip}>🏆 Bästa nivå: {bestLevel}</span>}
        </div>
      )}

      <div style={styles.playButtonBorder}>
        <button onClick={onPlay} style={{ ...styles.playButton, animation: playedToday ? "none" : "skrammelBlink 1.2s steps(1, end) infinite" }}>
          Dagens Skrammel
        </button>
      </div>
      <div style={styles.playButtonBorder}>
        <button onClick={onPlayHets} style={styles.playButton}>Solo-Hets</button>
      </div>
      {user && (
        <div style={styles.playButtonBorder}>
          <button
            onClick={blixtNeedsMove ? onGoToBlixt : onPlayBlixt}
            style={{ ...styles.playButton, animation: blixtHasActivity ? "skrammelBlink 1.2s steps(1, end) infinite" : "none" }}
          >
            BlixtSkrammel
          </button>
        </div>
      )}
      {user && (
        <div style={styles.playButtonBorder}>
          <button
            onClick={skrammelpajNeedsMove ? onGoToSkrammelpaj : onPlaySkrammelpaj}
            style={{ ...styles.playButton, animation: skrammelpajHasActivity ? "skrammelBlink 1.2s steps(1, end) infinite" : "none" }}
          >
            SkrammelPaj
          </button>
        </div>
      )}
      <div style={styles.secondaryRow}>
        <button onClick={onTopplistor} style={styles.secondaryButton}>Topplistor</button>
        {user && <button onClick={onFriends} style={styles.secondaryButton}>Vänner</button>}
      </div>

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
  statsRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" },
  statChip: {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999,
    padding: "0.3rem 0.7rem", fontSize: "0.85rem", color: T.text,
  },
  secondaryRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" },
  secondaryButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
  authRow: { marginTop: "2rem", fontSize: "0.85rem", color: T.muted },
};
