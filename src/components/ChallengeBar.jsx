import { T } from "../theme.js";

// Samma regnbågsordning som WordLengthHistogram, som en gradient för ramen.
// Upprepar första färgen sist så den rörliga fyllnaden loopar sömlöst.
const RAINBOW_BORDER = "linear-gradient(90deg, #b39ddb, #7ec8f2, #5fd0c4, #7bd88f, #f2a65a, #f26d6d)";
const RAINBOW_FILL = "linear-gradient(90deg, #b39ddb, #7ec8f2, #5fd0c4, #7bd88f, #f2a65a, #f26d6d, #b39ddb)";

// Ett stort piller, full bredd, samma höjd som de små ordlängd-pillren.
// Visar aktuell nivå (t.ex. "PROFFS") och fyller upp mot NÄSTA nivås mål —
// fyllnaden nollställs och börjar om varje gång en nivå klaras, som en
// vanlig XP-bar. Ram + fyllnad: rörlig regnbågsgradient.
export default function ChallengeBar({ currentScore, levels, totalPossibleScore }) {
  const nextLevel = levels.find((lvl) => currentScore < lvl.target);
  const allComplete = !nextLevel;
  const activeLevel = nextLevel ?? levels[levels.length - 1];
  const activeIndex = levels.indexOf(activeLevel);
  const isTopLevel = activeIndex === levels.length - 1;
  const prevTarget = activeIndex > 0 ? levels[activeIndex - 1].target : 0;
  const segmentSize = activeLevel.target - prevTarget;
  const segmentProgress = allComplete
    ? 1
    : Math.min(Math.max((currentScore - prevTarget) / segmentSize, 0), 1);
  const showTotalAsTarget = isTopLevel && allComplete && totalPossibleScore != null;
  const displayTarget = showTotalAsTarget ? totalPossibleScore : activeLevel.target;

  return (
    <div style={styles.borderWrap}>
      <style>{`
        @keyframes challengeRainbowShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div style={styles.inner}>
        <div
          style={{
            ...styles.fill,
            width: `${segmentProgress * 100}%`,
            opacity: allComplete ? 0.6 : 0.35,
            boxShadow: allComplete ? `0 0 14px ${T.accent}` : "none",
          }}
        />
        <span style={styles.text}>
          {allComplete ? "🎉 " : ""}{activeLevel.name}: {currentScore} / {displayTarget} poäng
          {isTopLevel && !allComplete && totalPossibleScore != null ? ` (max ${totalPossibleScore})` : ""}
        </span>
      </div>
    </div>
  );
}

const styles = {
  borderWrap: {
    width: "100%", padding: "2px", borderRadius: 999,
    background: RAINBOW_BORDER, flexShrink: 0,
  },
  inner: {
    position: "relative", overflow: "hidden", borderRadius: 999,
    background: T.bg, padding: "0.45rem 0.4rem",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  fill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    background: RAINBOW_FILL, backgroundSize: "300% 100%",
    animation: "challengeRainbowShift 4s linear infinite",
    transition: "width 0.4s ease, opacity 0.2s ease, box-shadow 0.2s ease",
  },
  text: {
    position: "relative", fontWeight: 700, fontSize: "0.9rem", color: T.text,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
};
