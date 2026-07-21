import { useState } from "react";
import { T } from "../theme.js";
import { classifyChallenge, computeChallengeStats, openChallengeCount } from "../api/blixt.js";
import { BLIXT_MAX_OPEN_CHALLENGES, BLIXT_ACCEPT_DEADLINE_HOURS } from "../game/blixtConstants.js";

const OPEN_CHALLENGE_VISIBLE_MS = 48 * 60 * 60 * 1000;

function opponentNameOf(challenge, userId) {
  return challenge.creator_id === userId ? challenge.opponent_display_name : challenge.creator_display_name;
}

function opponentIdOf(challenge, userId) {
  return challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
}

// Slår ihop flera samtidiga utmaningar mot samma motståndare inom en
// sektion till en grupp, så listan tar mindre plats när man har flera
// matcher på gång mot samma person.
function groupByOpponent(challenges, userId) {
  const groups = [];
  const byId = new Map();
  for (const c of challenges) {
    const opponentId = opponentIdOf(c, userId);
    let group = byId.get(opponentId);
    if (!group) {
      group = { opponentId, opponentName: opponentNameOf(c, userId), challenges: [] };
      byId.set(opponentId, group);
      groups.push(group);
    }
    group.challenges.push(c);
  }
  return groups;
}

function scoresOf(challenge, userId) {
  const opponentId = challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;
  const rows = challenge.blixt_scores ?? [];
  return {
    mine: rows.find((s) => s.user_id === userId),
    theirs: rows.find((s) => s.user_id === opponentId),
  };
}

// Skiljer på ord ni båda hittade, och ord bara en av er hittade — det är
// den jämförelsen som gör resultatet pedagogiskt istället för bara en siffra.
function wordDiff(mineWords, theirWords) {
  const mine = new Set(mineWords ?? []);
  const theirs = new Set(theirWords ?? []);
  return {
    both: [...mine].filter((w) => theirs.has(w)).sort(),
    onlyMine: [...mine].filter((w) => !theirs.has(w)).sort(),
    onlyTheirs: [...theirs].filter((w) => !mine.has(w)).sort(),
  };
}

function Section({ title, note, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {note && <div style={styles.sectionNote}>{note}</div>}
      <div style={styles.list}>{children}</div>
    </div>
  );
}

function WordChips({ words, variant }) {
  if (words.length === 0) return <span style={styles.noWords}>Inga</span>;
  return (
    <div style={styles.wordList}>
      {words.map((w) => (
        <span key={w} style={{ ...styles.wordChip, ...(variant === "shared" ? styles.wordChipShared : null) }}>
          {w}
        </span>
      ))}
    </div>
  );
}

function ResultCard({ challenge, userId }) {
  const opponentName = opponentNameOf(challenge, userId);
  const { mine, theirs } = scoresOf(challenge, userId);
  const myScore = mine?.score ?? 0;
  const theirScore = theirs?.score ?? 0;
  const verdict = myScore > theirScore ? "Vann" : myScore < theirScore ? "Förlorade" : "Oavgjort";
  const verdictColor = myScore > theirScore ? T.accent : myScore < theirScore ? T.accent2 : T.muted;
  const { both, onlyMine, onlyTheirs } = wordDiff(mine?.words_found, theirs?.words_found);
  const maxScore = Math.max(myScore, theirScore, 1);

  return (
    <div style={styles.resultCard}>
      <div style={styles.resultHeader}>
        <span>{opponentName}</span>
        <span style={{ color: verdictColor, fontWeight: 700 }}>{verdict}</span>
      </div>

      <div style={styles.scoreBars}>
        <div style={styles.scoreBarRow}>
          <span style={styles.scoreBarLabel}>Du</span>
          <div style={styles.scoreBarTrack}>
            <div style={{ ...styles.scoreBarFill, width: `${(myScore / maxScore) * 100}%`, background: T.accent }} />
          </div>
          <span style={styles.scoreBarValue}>{myScore}</span>
        </div>
        <div style={styles.scoreBarRow}>
          <span style={styles.scoreBarLabel}>{opponentName}</span>
          <div style={styles.scoreBarTrack}>
            <div style={{ ...styles.scoreBarFill, width: `${(theirScore / maxScore) * 100}%`, background: T.muted }} />
          </div>
          <span style={styles.scoreBarValue}>{theirScore}</span>
        </div>
      </div>

      <div style={styles.wordBreakdown}>
        <div style={styles.wordGroup}>
          <div style={styles.wordGroupLabel}>Ord ni båda hittade ({both.length})</div>
          <WordChips words={both} variant="shared" />
        </div>
        <div style={styles.wordGroup}>
          <div style={styles.wordGroupLabel}>Bara du hittade ({onlyMine.length})</div>
          <WordChips words={onlyMine} />
        </div>
        <div style={styles.wordGroup}>
          <div style={styles.wordGroupLabel}>Bara {opponentName} hittade ({onlyTheirs.length})</div>
          <WordChips words={onlyTheirs} />
        </div>
      </div>
    </div>
  );
}

// Visar en enda rad per motståndare. Med bara en match mot personen blir
// det en vanlig rad; med flera blir det en hopfälld rad med antal som
// fälls ut vid klick, så var och en av matcherna kan spelas/svaras på/tas
// bort för sig.
function ChallengeGroup({ opponentName, challenges, renderActions }) {
  const [expanded, setExpanded] = useState(false);

  if (challenges.length === 1) {
    return (
      <div style={styles.row}>
        <span>{opponentName}</span>
        <div style={styles.rowActions}>{renderActions(challenges[0])}</div>
      </div>
    );
  }

  return (
    <div style={styles.group}>
      <button onClick={() => setExpanded((v) => !v)} style={styles.groupHeader}>
        <span>{opponentName} ({challenges.length})</span>
        <span style={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={styles.groupList}>
          {challenges.map((c, i) => (
            <div key={c.id} style={styles.row}>
              <span style={styles.groupRowLabel}>Blixt {i + 1}</span>
              <div style={styles.rowActions}>{renderActions(c)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...styles.tabButton, ...(active ? styles.tabButtonActive : null) }}>
      {children}
    </button>
  );
}

// En rads knappar beror på vilken av de två delstatusarna som slogs ihop
// till samma sektion (PÅGÅENDE: din tur / motståndarens tur, VÄNTANDE:
// väntar på ditt svar / väntar på motståndarens svar) — avgörs per rad här
// istället för att hålla fyra separata sektioner som förut. Samma mönster
// som SkrammelpajScreen.jsx.
function ongoingActions(challenge, userId, onPlay, onDelete) {
  return classifyChallenge(challenge, userId) === "your_turn"
    ? (
      <>
        <button onClick={() => onPlay(challenge)} style={styles.smallButton}>Spela</button>
        <button onClick={() => onDelete(challenge.id)} style={styles.smallButtonMuted}>Ta bort</button>
      </>
    )
    : <button onClick={() => onDelete(challenge.id)} style={styles.smallButtonMuted}>Ta bort</button>;
}

function waitingActions(challenge, userId, onRespond, onDelete) {
  return classifyChallenge(challenge, userId) === "needs_response"
    ? (
      <>
        <button onClick={() => onRespond(challenge.id, true)} style={styles.smallButton}>Anta</button>
        <button onClick={() => onRespond(challenge.id, false)} style={styles.smallButtonMuted}>Ignorera</button>
        <button onClick={() => onDelete(challenge.id)} style={styles.smallButtonMuted}>Ta bort</button>
      </>
    )
    : <button onClick={() => onDelete(challenge.id)} style={styles.smallButtonMuted}>Ta bort</button>;
}

export default function BlixtScreen({ user, challenges, onRespond, onPlay, onPlayNew, onDelete, onLeaderboard, onBack }) {
  const [tab, setTab] = useState("open");

  const openCount = openChallengeCount(challenges, user.id);
  const atCap = openCount >= BLIXT_MAX_OPEN_CHALLENGES;
  const stats = computeChallengeStats(challenges, user.id);

  const now = Date.now();
  const visibleOpen = challenges.filter((c) => {
    if (classifyChallenge(c, user.id) === "completed") return false;
    return now - new Date(c.created_at).getTime() < OPEN_CHALLENGE_VISIBLE_MS;
  });
  const completed = challenges.filter((c) => classifyChallenge(c, user.id) === "completed");

  const ongoing = visibleOpen.filter((c) => {
    const status = classifyChallenge(c, user.id);
    return status === "your_turn" || status === "waiting_opponent_play";
  });
  const waitingToStart = visibleOpen.filter((c) => {
    const status = classifyChallenge(c, user.id);
    return status === "needs_response" || status === "waiting_opponent_response";
  });

  return (
    <div style={styles.page}>
      <h2 style={{ margin: 0, color: T.accent }}>⚡ Blixt</h2>
      <div style={{ color: T.muted, fontSize: "0.85rem" }}>
        {openCount}/{BLIXT_MAX_OPEN_CHALLENGES} matcher pågår
      </div>

      <button onClick={onPlayNew} disabled={atCap} style={{ ...styles.playButton, opacity: atCap ? 0.5 : 1 }}>
        {atCap ? "Max antal matcher nått" : "Spela en blixt"}
      </button>

      <div style={styles.tabRow}>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>Ej spelade</TabButton>
        <TabButton active={tab === "results"} onClick={() => setTab("results")}>Resultat</TabButton>
      </div>

      {tab === "open" && (
        <>
          {visibleOpen.length === 0 && (
            <div style={{ color: T.muted }}>Inga öppna utmaningar just nu.</div>
          )}

          {ongoing.length > 0 && (
            <Section title="PÅGÅENDE">
              {groupByOpponent(ongoing, user.id).map((g) => (
                <ChallengeGroup
                  key={g.opponentId}
                  opponentName={g.opponentName}
                  challenges={g.challenges}
                  renderActions={(c) => ongoingActions(c, user.id, onPlay, onDelete)}
                />
              ))}
            </Section>
          )}

          {waitingToStart.length > 0 && (
            <Section
              title="VÄNTANDE"
              note={`En obesvarad utmaning tas bort automatiskt om den inte antas inom ${BLIXT_ACCEPT_DEADLINE_HOURS} timmar.`}
            >
              {groupByOpponent(waitingToStart, user.id).map((g) => (
                <ChallengeGroup
                  key={g.opponentId}
                  opponentName={g.opponentName}
                  challenges={g.challenges}
                  renderActions={(c) => waitingActions(c, user.id, onRespond, onDelete)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {tab === "results" && (
        <>
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

          {completed.length === 0 && (
            <div style={{ color: T.muted }}>Inga avslutade matcher än.</div>
          )}

          {completed.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Avslutade matcher</div>
              <div style={styles.list}>
                {completed.map((c) => (
                  <ResultCard key={c.id} challenge={c} userId={user.id} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={styles.navRow}>
        <button onClick={onLeaderboard} style={styles.navButton}>Topplista</button>
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
  tabRow: { display: "flex", gap: "0.4rem", width: "100%", maxWidth: 400 },
  tabButton: {
    flex: 1, padding: "0.5rem 0.9rem", borderRadius: 999, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
  },
  tabButtonActive: { background: T.accent, borderColor: T.accent, color: "#121212" },
  section: { width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: "0.4rem" },
  sectionTitle: {
    color: T.accent, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.04em", textAlign: "left",
  },
  sectionNote: { color: T.muted, fontSize: "0.75rem", textAlign: "left", marginTop: "-0.2rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`,
  },
  rowActions: { display: "flex", gap: "0.4rem" },
  group: {
    display: "flex", flexDirection: "column", gap: "0.3rem",
    background: T.surface, borderRadius: 6, border: `1px solid ${T.border}`, overflow: "hidden",
  },
  groupHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem",
    background: "transparent", border: "none", color: T.text, fontSize: "1rem", fontFamily: "inherit",
    cursor: "pointer", width: "100%",
  },
  chevron: { color: T.muted, fontSize: "0.7rem" },
  groupList: {
    display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0 0.5rem 0.5rem",
  },
  groupRowLabel: { color: T.muted, fontSize: "0.85rem" },
  smallButton: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
  },
  smallButtonMuted: {
    padding: "0.4rem 0.7rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.8rem", cursor: "pointer",
  },
  resultCard: {
    display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.75rem",
    background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, textAlign: "left",
  },
  resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.95rem" },
  scoreBars: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  scoreBarRow: { display: "flex", alignItems: "center", gap: "0.5rem" },
  scoreBarLabel: { width: 70, flexShrink: 0, color: T.muted, fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  scoreBarTrack: { flex: 1, height: 8, borderRadius: 999, background: T.bg, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 999 },
  scoreBarValue: { width: 28, flexShrink: 0, textAlign: "right", fontSize: "0.85rem", fontWeight: 700 },
  wordBreakdown: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  wordGroup: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  wordGroupLabel: { color: T.muted, fontSize: "0.75rem" },
  wordList: { display: "flex", flexWrap: "wrap", gap: "0.3rem" },
  wordChip: {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999,
    padding: "0.15rem 0.5rem", fontSize: "0.78rem",
  },
  wordChipShared: { borderColor: T.accent, color: T.accent },
  noWords: { color: T.muted, fontSize: "0.78rem" },
  navRow: { display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem", justifyContent: "center" },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer",
  },
};
