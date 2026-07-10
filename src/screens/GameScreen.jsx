import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { T } from "../theme.js";
import { GAME_DURATION_SECONDS } from "../game/constants.js";
import { letterCounts } from "../game/letters.js";
import { evaluateGuess, GuessResult } from "../game/evaluateGuess.js";
import { totalScore } from "../game/scoring.js";
import { findWordsInSource } from "../game/findWords.js";
import { getDictionary } from "../game/wordList.js";
import { playClickSound, playFanfareSound } from "../audio/sounds.js";
import WordLengthHistogram from "../components/WordLengthHistogram.jsx";

function groupByLength(words) {
  const counts = {};
  for (const word of words) counts[word.length] = (counts[word.length] ?? 0) + 1;
  return counts;
}

const FEEDBACK_MESSAGES = {
  [GuessResult.TOO_SHORT]: "Minst 2 bokstäver",
  [GuessResult.ALREADY_FOUND]: "Redan hittat",
  [GuessResult.IS_SOURCE_WORD]: "Hitta andra ord än källordet!",
  [GuessResult.NOT_IN_SOURCE]: "Finns inte i ordet",
  [GuessResult.NOT_A_WORD]: "Ej godkänt ord",
};

// Brickornas bredd fylls av flexbox (verklig skärmbredd, ingen gissning).
// Det här räknar bara ut en rimlig textstorlek utifrån en uppskattad bredd,
// så texten inte blir för stor för smala brickor vid långa källord.
function tileMetrics(letterCount) {
  const estimatedContentWidth = 380; // px, generös uppskattning av mobilbredd
  const gap = 3; // px — snålt mellanrum, mer yta åt själva brickorna
  const estWidth = (estimatedContentWidth - (letterCount - 1) * gap) / letterCount;
  const font = Math.max(16, Math.min(28, Math.floor(estWidth * 0.5)));
  return { font, gap };
}

export default function GameScreen({ sourceWord, onFinish }) {
  const sourceLetters = useMemo(() => sourceWord.split(""), [sourceWord]);
  const sourceCounts = useMemo(() => letterCounts(sourceWord), [sourceWord]);
  const { font: tileFont, gap: tileGap } = useMemo(
    () => tileMetrics(sourceLetters.length),
    [sourceLetters.length]
  );
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  // Ordnad lista av index i sourceWord som är intryckta för det ord som byggs just nu.
  const [tappedIndices, setTappedIndices] = useState([]);
  const [found, setFound] = useState([]); // [{ word, score }]
  const [feedback, setFeedback] = useState(null);
  const foundWords = useMemo(() => new Set(found.map((f) => f.word)), [found]);
  const usedIndices = useMemo(() => new Set(tappedIndices), [tappedIndices]);
  const currentWord = useMemo(
    () => tappedIndices.map((i) => sourceLetters[i]).join(""),
    [tappedIndices, sourceLetters]
  );
  const totalByLength = useMemo(
    () => groupByLength(findWordsInSource(sourceWord, getDictionary())),
    [sourceWord]
  );
  const foundByLength = useMemo(
    () => groupByLength(found.map((f) => f.word)),
    [found]
  );
  const [highlightLength, setHighlightLength] = useState(null);
  const highlightTimeoutRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(totalScore(found.map((f) => f.word)), found.map((f) => f.word));
  }, [found, onFinish]);

  useEffect(() => {
    if (timeLeft <= 0) { finish(); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, finish]);

  const handleTileTap = (i) => {
    if (usedIndices.has(i)) return;
    playClickSound();
    setTappedIndices((prev) => [...prev, i]);
    setFeedback(null);
  };

  const handleBackspace = () => {
    setTappedIndices((prev) => prev.slice(0, -1));
    setFeedback(null);
  };

  const handleClearAll = () => {
    setTappedIndices([]);
    setFeedback(null);
  };

  const handleSubmit = () => {
    const result = evaluateGuess(currentWord, sourceWord, sourceCounts, foundWords);
    if (result.status === GuessResult.OK) {
      playFanfareSound();
      setFound((f) => [...f, { word: result.word, score: result.score }]);
      setTappedIndices([]);
      setFeedback(null);
      setHighlightLength(result.word.length);
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightLength(null), 1000);
    } else {
      setFeedback(FEEDBACK_MESSAGES[result.status]);
    }
  };

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  return (
    <div style={styles.page}>
      <div style={{ ...styles.timer, color: timeLeft <= 30 ? T.accent2 : T.muted }}>
        {minutes}:{seconds}
      </div>

      <div style={styles.foundSection}>
        <div style={{ color: T.muted, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
          {found.length} ord · {totalScore(found.map((f) => f.word))} poäng
        </div>

        <div style={styles.foundList}>
          {found.map((f) => (
            <div key={f.word} style={styles.foundChip}>
              {f.word} <span style={{ color: T.accent }}>+{f.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.histogramSection}>
        <div style={styles.histogramLabel}>Ord att hitta, per bokstavslängd</div>
        <WordLengthHistogram totalByLength={totalByLength} foundByLength={foundByLength} highlightLength={highlightLength} />
      </div>

      <div style={styles.bottomArea}>
        <div style={{ ...styles.tileRow, gap: `${tileGap}px` }}>
          {sourceLetters.map((_, slot) => {
            const filled = slot < tappedIndices.length;
            return (
              <div
                key={slot}
                style={{
                  ...styles.tile, fontSize: tileFont,
                  ...(filled ? null : styles.tileUsed),
                }}
              >
                {filled ? sourceLetters[tappedIndices[slot]] : ""}
              </div>
            );
          })}
        </div>

        <div style={styles.feedback}>{feedback}</div>

        <div style={{ ...styles.tileRow, gap: `${tileGap}px` }}>
          {sourceLetters.map((letter, i) => {
            const used = usedIndices.has(i);
            return (
              <button
                key={i}
                data-tile-index={i}
                onClick={() => handleTileTap(i)}
                disabled={used}
                style={{
                  ...styles.tile, fontSize: tileFont,
                  ...(used ? styles.tileUsed : null),
                }}
              >
                {used ? "" : letter}
              </button>
            );
          })}
        </div>

        <div style={styles.controlsRow}>
          <button
            onClick={handleBackspace}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.iconButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
            aria-label="Ta bort sista bokstaven"
          >
            ←
          </button>
          <button
            onClick={handleClearAll}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.clearAllButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
          >
            RENSA
          </button>
          <button
            onClick={handleSubmit}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.submitButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", padding: "1rem 0.5rem 1.25rem",
    boxSizing: "border-box",
  },
  timer: { fontVariantNumeric: "tabular-nums", fontSize: "1.5rem" },
  foundSection: { marginTop: "1rem", width: "100%", maxWidth: 480, flex: 1, overflowY: "auto" },
  histogramSection: { width: "100%", maxWidth: 480, margin: "0.5rem 0 1rem" },
  histogramLabel: { color: T.muted, fontSize: "0.8rem", textAlign: "center", marginBottom: "0.5rem" },
  foundList: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  foundChip: {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.85rem",
  },
  bottomArea: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center" },
  feedback: {
    color: T.accent2, fontSize: "0.9rem", fontWeight: 600, textAlign: "center",
    minHeight: "1.3rem", margin: "0.6rem 0",
  },
  tileRow: {
    display: "flex", flexWrap: "nowrap", width: "100%",
  },
  controlsRow: { display: "flex", gap: "0.6rem", width: "100%", marginTop: "0.8rem" },
  iconButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontWeight: 700, fontSize: "1.3rem", cursor: "pointer", padding: 0,
  },
  clearAllButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontWeight: 600, fontSize: "1rem", cursor: "pointer",
  },
  submitButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1.05rem", cursor: "pointer",
  },
  tile: {
    flex: "1 1 0", minWidth: 0, height: "3.8rem",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    color: T.tileText, cursor: "pointer", padding: 0,
  },
  tileUsed: {
    background: T.tileEmpty, border: `1px dashed ${T.tileEmptyBorder}`, cursor: "default",
  },
};
