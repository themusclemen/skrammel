import { T } from "../theme.js";
import { classifyChallenge, computeChallengeStats, openChallengeCount } from "../api/blixt.js";
import { BLIXT_MAX_OPEN_CHALLENGES } from "../game/blixtConstants.js";

function opponentNameOf(challenge, userId) {
  return challenge.creator_id === userId ? challenge.opponent_display_name : challenge.creator_display_name;
}

function scoresOf(challenge, userId) {
  const opponentId = challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
  const rows = challenge.blixt_scores ?? [];
  return {
    mine: rows.find((s) => s.user_id === userId)?.score,
    theirs: rows.find((s) => s.user_id === opponentId)?.score,
  };
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.list}>{children}</div>
    </div>
  );
}

export default function BlixtScreen({ user, challenges, onRespond, onPlay, onPlayNew, onBack }) {
  const openCount = openChallengeCount(challenges, user.id);
  const atCap = openCount >= BLIXT_MAX_OPEN_CHALLENGES;
  const stats = computeChallengeStats(challenges, user.id);

  const grouped = {
    needs_response: [], your_turn: [], waiting_opponent_response: [], waiting_opponent_play: [], completed: [],
  };
  for (const c of challenges) grouped[classifyChallenge(c, user.id)].push(c);

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>⚡ Blixt</h2>
      <div style={{ color: T.muted, fontSize: "0.85rem" }}>
        {openCount}/{BLIXT_MAX_OPEN_CHALLENGES} matcher pågår
      </div>

      <button onClick={onPlayNew} disabled={atCap} style={{ ...styles.playButton, opacity: atCap ? 0.5 : 1 }}>
        {atCap ? "Max antal matcher nått" : "Spela en blixt"}
      </button>

      {grouped.needs_response.length > 0 && (
        <Section title="Väntar på ditt svar">
          {grouped.needs_response.map((c) => (
            <div key={c.id} style={styles.row}>
              <span>{opponentNameOf(c, user.id)}</span>
              <div style={styles.rowActions}>
                <button onClick={() => onRespond(c.id, true)} style={styles.smallButton}>Anta</button>
                <button onClick={() => onRespond(c.id, false)} style={styles.smallButtonMuted}>Ignorera</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {grouped.your_turn.length > 0 && (
        <Section title="Din tur att spela">
          {grouped.your_turn.map((c) => (
            <div key={c.id} style={styles.row}>
              <span>{opponentNameOf(c, user.id)}</span>
              <button onClick={() => onPlay(c)} style={styles.smallButton}>Spela</button>
            </div>
          ))}
        </Section>
      )}

      {grouped.waiting_opponent_response.length > 0 && (
        <Section title="Väntar på svar">
          {grouped.waiting_opponent_response.map((c) => (
            <div key={c.id} style={styles.row}>
              <span>{opponentNameOf(c, user.id)}</span>
            </div>
          ))}
        </Section>
      )}

      {grouped.waiting_opponent_play.length > 0 && (
        <Section title="Väntar på motståndaren">
          {grouped.waiting_opponent_play.map((c) => (
            <div key={c.id} style={styles.row}>
              <span>{opponentNameOf(c, user.id)}</span>
            </div>
          ))}
        </Section>
      )}

      {grouped.completed.length > 0 && (
        <Section title="Avslutade">
          {grouped.completed.map((c) => {
            const { mine, theirs } = scoresOf(c, user.id);
            const verdict = mine > theirs ? "Vann" : mine < theirs ? "Förlorade" : "Oavgjort";
            return (
              <div key={c.id} style={styles.row}>
                <span>{opponentNameOf(c, user.id)}</span>
                <span style={{ color: T.muted, fontSize: "0.85rem" }}>{mine}–{theirs} · {verdict}</span>
              </div>
            );
          })}
        </Section>
      )}

      {stats.length > 0 && (
        <Section title="Vinst/förlust per motståndare">
          {stats.map((s) => (
            <div key={s.opponentId} style={styles.row}>
              <span>{s.opponentName}</span>
              <span style={{ color: T.muted, fontSize: "0.85rem" }}>{s.wins}V – {s.losses}F</span>
            </div>
          ))}
        </Section>
      )}

      <div style={styles.navRow}>
        <button onClick={onBack} style={styles.navButton}>Till start</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center",
    gap: "0.8rem", textAlign: "center",
  },
  playButton: {
    padding: "0.8rem 1.2rem", borderRadius: 10, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer", width: "100%", maxWidth: 320,
  },
  section: { width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: "0.4rem" },
  sectionTitle: { color: T.muted, fontSize: "0.8rem", fontWeight: 700, textAlign: "left" },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  rowActions: { display: "flex", gap: "0.4rem" },
  smallButton: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
  },
  smallButtonMuted: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.8rem", cursor: "pointer",
  },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
