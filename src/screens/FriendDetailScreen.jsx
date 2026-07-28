import { T } from "../theme.js";
import { computeChallengeStats as computeBlixtStats, classifyChallenge as classifyBlixtChallenge } from "../api/blixt.js";
import {
  computeChallengeStats as computeSkrammelpajStats,
  classifyChallenge as classifySkrammelpajChallenge,
} from "../api/skrammelpaj.js";
import { computeOngoingByOpponent } from "../game/matchActivity.js";

function StatRow({ label, stats, ongoing, onGoToMatches }) {
  return (
    <div style={styles.statRow}>
      <div style={styles.statRowTop}>
        <span>{label}</span>
        <span style={{ color: T.muted }}>
          {stats ? `${stats.wins} vunna – ${stats.losses} förlorade` : "Inga avslutade matcher än"}
        </span>
      </div>
      {ongoing && ongoing.ongoingCount > 0 && (
        <button onClick={onGoToMatches} style={styles.ongoingButton}>
          {ongoing.ongoingCount} match{ongoing.ongoingCount > 1 ? "er" : ""} på gång — gå till mina matcher
        </button>
      )}
    </div>
  );
}

export default function FriendDetailScreen({
  user, friend, myBlixtChallenges, mySkrammelpajChallenges,
  onChallengeBlixt, onChallengeSkrammelpaj, onGoToBlixt, onGoToSkrammelpaj, onBack,
}) {
  const blixtStats = computeBlixtStats(myBlixtChallenges, user.id).find((s) => s.opponentId === friend.id);
  const skrammelpajStats = computeSkrammelpajStats(mySkrammelpajChallenges, user.id).find((s) => s.opponentId === friend.id);
  const blixtOngoing = computeOngoingByOpponent(myBlixtChallenges, user.id, classifyBlixtChallenge).get(friend.id);
  const skrammelpajOngoing = computeOngoingByOpponent(mySkrammelpajChallenges, user.id, classifySkrammelpajChallenge)
    .get(friend.id);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>{friend.name}</h2>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Utmana</div>
        <button onClick={onChallengeBlixt} style={styles.actionButton}>⚡ Utmana i Blixt-Duell</button>
        <button onClick={onChallengeSkrammelpaj} style={styles.actionButton}>🔤 Utmana i Bokstavs-Duell</button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Chatt</div>
        <button disabled style={{ ...styles.actionButton, ...styles.disabledButton }}>💬 Chatta (Kommer snart)</button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Statistik</div>
        <StatRow label="⚡ Blixt-Duell" stats={blixtStats} ongoing={blixtOngoing} onGoToMatches={onGoToBlixt} />
        <StatRow
          label="🔤 Bokstavs-Duell" stats={skrammelpajStats} ongoing={skrammelpajOngoing}
          onGoToMatches={onGoToSkrammelpaj}
        />
      </div>

      <div style={styles.navRow}>
        <button onClick={onBack} style={styles.navButton}>Till vänner</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1.2rem", textAlign: "center",
  },
  section: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: 360 },
  sectionTitle: { color: T.muted, fontSize: "0.85rem", textAlign: "left" },
  actionButton: {
    padding: "0.8rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
  },
  disabledButton: { background: T.surface, color: T.muted, cursor: "not-allowed", fontWeight: 600 },
  statRow: {
    display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.6rem 0.8rem",
    background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
  },
  statRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  ongoingButton: {
    padding: "0.5rem 0.7rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
