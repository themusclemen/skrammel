import { T } from "../theme.js";

// Samma regnbågsstil som ChallengeBar, men målet är fast (motståndarens
// resultat) istället för en nivåstege — hålls synlig under hela
// blixtrundan så spelaren alltid ser hur mycket som krävs för att vinna.
const RAINBOW_BORDER = "linear-gradient(90deg, #b39ddb, #7ec8f2, #5fd0c4, #7bd88f, #f2a65a, #f26d6d)";
const RAINBOW_FILL = "linear-gradient(90deg, #b39ddb, #7ec8f2, #5fd0c4, #7bd88f, #f2a65a, #f26d6d, #b39ddb)";

export default function BeatScoreBar({ currentScore, targetScore, opponentName }) {
  const passed = currentScore > targetScore;
  const progress = Math.min(currentScore / Math.max(targetScore, 1), 1);

  return (
    <div style={styles.borderWrap}>
      <style>{`
        @keyframes beatScoreRainbowShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div style={styles.inner}>
        <div
          style={{
            ...styles.fill,
            width: `${progress * 100}%`,
            opacity: passed ? 0.6 : 0.35,
            boxShadow: passed ? `0 0 14px ${T.accent}` : "none",
          }}
        />
        <span style={styles.text}>
          {passed ? "🔥 Du leder! " : `Slå ${opponentName}: `}{currentScore} / {targetScore} poäng
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
    animation: "beatScoreRainbowShift 4s linear infinite",
    transition: "width 0.4s ease, opacity 0.2s ease, box-shadow 0.2s ease",
  },
  text: {
    position: "relative", fontWeight: 700, fontSize: "0.9rem", color: T.text,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
};
