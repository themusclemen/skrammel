import { T } from "../theme.js";

// Samlad ingång till appens tre topplistor. De tre spelen mäter olika saker
// (poäng på ett datum vs. vunna dueller) så istället för att tvinga ihop dem
// i en enda tabell länkar den här skärmen bara vidare till varje spels egen,
// redan byggda topplista (LeaderboardScreen/BlixtLeaderboardScreen/
// SkrammelpajLeaderboardScreen) — med en kort förklaring av vad var och en
// visar, så valet är begripligt innan man klickar.
export default function TopplistorScreen({ onDailyLeaderboard, onBlixtLeaderboard, onSkrammelpajLeaderboard, onBack }) {
  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>🏆 Topplistor</h2>
      <div style={{ color: T.muted, fontSize: "0.9rem" }}>Välj vilken topplista du vill se</div>

      <button onClick={onDailyLeaderboard} style={styles.card}>
        <div style={styles.cardTitle}>✨ Dagens Skrammel</div>
        <div style={styles.cardDesc}>Dagens ord, rankat efter poäng — en ny lista varje dag</div>
      </button>

      <button onClick={onBlixtLeaderboard} style={styles.card}>
        <div style={styles.cardTitle}>⚡ BlixtSkrammel</div>
        <div style={styles.cardDesc}>Rankat efter flest vunna dueller totalt</div>
      </button>

      <button onClick={onSkrammelpajLeaderboard} style={styles.card}>
        <div style={styles.cardTitle}>🥧 SkrammelPaj</div>
        <div style={styles.cardDesc}>Rankat efter flest vunna dueller totalt</div>
      </button>

      <button onClick={onBack} style={styles.backButton}>Till start</button>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.8rem", textAlign: "center",
  },
  card: {
    width: "100%", maxWidth: 380, padding: "0.9rem 1.1rem", borderRadius: 12,
    border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer",
    display: "flex", flexDirection: "column", gap: "0.25rem", textAlign: "left",
  },
  cardTitle: { color: T.accent, fontWeight: 700, fontSize: "1.05rem" },
  cardDesc: { color: T.muted, fontSize: "0.85rem" },
  backButton: {
    marginTop: "0.5rem", padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.9rem", cursor: "pointer",
  },
};
