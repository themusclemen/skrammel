import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { T } from "../theme.js";
import { GAME_DURATION_SECONDS } from "../game/constants.js";
import { letterCounts } from "../game/letters.js";
import { evaluateGuess, GuessResult } from "../game/evaluateGuess.js";
import { totalScore } from "../game/scoring.js";
import { findWordsInSource } from "../game/findWords.js";
import { getDictionary } from "../game/wordList.js";
import { computeLevelTargets } from "../game/levels.js";
import { playClickSound, playFanfareSound } from "../audio/sounds.js";
import WordLengthHistogram from "../components/WordLengthHistogram.jsx";
import ChallengeBar from "../components/ChallengeBar.jsx";
import WordLengthModal from "../components/WordLengthModal.jsx";
import GameMenuModal from "../components/GameMenuModal.jsx";
import TimeUpModal from "../components/TimeUpModal.jsx";

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

// Källradens brickor fyller raden med flexbox (verklig skärmbredd, ingen
// gissning). Det här räknar bara ut en rimlig textstorlek utifrån en
// uppskattad bredd, så texten inte blir för stor för smala brickor.
function tileMetrics(letterCount) {
  const estimatedContentWidth = 380; // px, generös uppskattning av mobilbredd
  const gap = 3; // px — snålt mellanrum, mer yta åt själva brickorna
  const estWidth = (estimatedContentWidth - (letterCount - 1) * gap) / letterCount;
  const font = Math.max(16, Math.min(28, Math.floor(estWidth * 0.5)));
  return { font, gap };
}

// Gissningsradens brickor har egen, intrinsisk storlek (inte flex-fill) —
// stora när ordet är kort, krymper ju längre ordet blir, så hela ordet
// alltid får plats centrerat.
function guessTileMetrics(letterCount) {
  const n = Math.max(letterCount, 1);
  const availableWidth = 320; // px
  const gap = 8; // px
  const rawSize = (availableWidth - (n - 1) * gap) / n;
  const size = Math.max(30, Math.min(76, rawSize));
  const font = Math.round(size * 0.52);
  return { size, font, gap };
}

export default function GameScreen({ sourceWord, onSubmitScore, onFinish }) {
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
  const [modalLength, setModalLength] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [timeIsUp, setTimeIsUp] = useState(false);
  // Sant när spelaren valt att fortsätta spela efter att tiden tog slut —
  // klockan döljs och räknas inte längre. Resultatet är redan sparat vid
  // det laget (se submitCurrentScore/timer-effekten nedan) oavsett vad
  // spelaren väljer, så fri spelning påverkar aldrig det sparade resultatet.
  const [freePlay, setFreePlay] = useState(false);
  const guessMetrics = useMemo(
    () => guessTileMetrics(tappedIndices.length),
    [tappedIndices.length]
  );
  const foundWords = useMemo(() => new Set(found.map((f) => f.word)), [found]);
  const lastFound = found.length > 0 ? found[found.length - 1] : null;
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
  const currentScore = totalScore(found.map((f) => f.word));
  const totalPossibleScore = useMemo(
    () => Object.entries(totalByLength).reduce((sum, [length, count]) => sum + Number(length) * count, 0),
    [totalByLength]
  );
  const levelTargets = useMemo(
    () => computeLevelTargets(totalPossibleScore),
    [totalPossibleScore]
  );
  // Vilken tid (sekunder från spelstart) spelaren nådde varje nivå på —
  // { [nivånamn]: elapsedSeconds } — sparas med resultatet för framtida topplistor.
  const [levelTimes, setLevelTimes] = useState({});
  const [highlightLength, setHighlightLength] = useState(null);
  const highlightTimeoutRef = useRef(null);
  const finishedRef = useRef(false);
  const submittedRef = useRef(false);

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  // Sparar resultatet — men bara första gången. Anropas dels direkt när
  // tiden går ut (oavsett vad spelaren sen väljer), dels från finish() om
  // spelaren avslutar innan dess (t.ex. via menyn). Det som eventuellt
  // hittas efter att tiden gått ut (fri spelning) påverkar aldrig det som
  // redan sparats, eftersom submittedRef då redan är satt.
  const submitCurrentScore = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmitScore(totalScore(found.map((f) => f.word)), found.map((f) => f.word), levelTimes);
  }, [found, onSubmitScore, levelTimes]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    submitCurrentScore();
    onFinish(totalScore(found.map((f) => f.word)), found.map((f) => f.word));
  }, [found, onFinish, submitCurrentScore]);

  useEffect(() => {
    if (freePlay) return; // Tiden räknas inte längre i fri spelning.
    if (timeLeft <= 0) {
      setTimeIsUp(true);
      submitCurrentScore();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, freePlay, submitCurrentScore]);

  const handleQuitAtTimeUp = () => {
    setTimeIsUp(false);
    finish();
  };

  const handleContinueFreePlay = () => {
    setTimeIsUp(false);
    setFreePlay(true);
  };

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

      const newScore = currentScore + result.score;
      const elapsed = GAME_DURATION_SECONDS - timeLeft;
      setLevelTimes((prev) => {
        const next = { ...prev };
        for (const lvl of levelTargets) {
          if (newScore >= lvl.target && !(lvl.name in next)) next[lvl.name] = elapsed;
        }
        return next;
      });
    } else {
      setFeedback(FEEDBACK_MESSAGES[result.status]);
    }
  };

  useEffect(() => {
    if (showMenu || timeIsUp || modalLength !== null) return;
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key.length === 1) {
        const letter = e.key.toUpperCase();
        const idx = sourceLetters.findIndex((l, i) => l === letter && !usedIndices.has(i));
        if (idx !== -1) handleTileTap(idx);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

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

      <div style={styles.statusCard}>
        <div style={styles.statusHalf}>
          <span style={styles.statusIcon}>⏱</span>
          <span style={{ ...styles.statusValue, color: !freePlay && timeLeft <= 30 ? T.accent2 : T.text }}>
            {freePlay ? "∞" : `${minutes}:${seconds}`}
          </span>
        </div>
        <div style={styles.statusDivider} />
        <div style={styles.statusHalf}>
          <span style={styles.statusIcon}>⭐</span>
          <span style={styles.statusValue}>
            {found.length} ord · {currentScore} poäng
          </span>
        </div>
      </div>

      <div style={styles.guessCenter}>
        {tappedIndices.length === 0 ? (
          <span style={styles.cursor}>_</span>
        ) : (
          <div style={{ ...styles.guessRow, gap: `${guessMetrics.gap}px` }}>
            {tappedIndices.map((sourceIdx, pos) => (
              <div
                key={pos}
                style={{
                  ...styles.guessTile,
                  width: guessMetrics.size, height: guessMetrics.size, fontSize: guessMetrics.font,
                }}
              >
                {sourceLetters[sourceIdx]}
              </div>
            ))}
          </div>
        )}

        {lastFound && (
          <div style={styles.lastFound}>
            {lastFound.word} <span style={{ color: T.accent }}>+{lastFound.score}</span>
          </div>
        )}

        <div style={styles.feedback}>{feedback}</div>
      </div>

      <div style={styles.bottomArea}>
        <div style={styles.challengeSection}>
          <ChallengeBar currentScore={currentScore} levels={levelTargets} totalPossibleScore={totalPossibleScore} />
        </div>

        <div style={styles.histogramSection}>
          <div style={styles.histogramLabel}>Ord kvar</div>
          <WordLengthHistogram
            totalByLength={totalByLength}
            foundByLength={foundByLength}
            highlightLength={highlightLength}
            onSelectLength={setModalLength}
          />
        </div>

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
            onClick={() => setShowMenu(true)}
            style={styles.iconButton}
            aria-label="Meny"
          >
            …
          </button>
          <button
            onClick={handleClearAll}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.clearAllButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
          >
            RENSA
          </button>
          <button
            onClick={handleBackspace}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.iconButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
            aria-label="Ta bort sista bokstaven"
          >
            ←
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

      {modalLength !== null && (
        <WordLengthModal
          length={modalLength}
          total={totalByLength[modalLength] ?? 0}
          words={found.filter((f) => f.word.length === modalLength)}
          onClose={() => setModalLength(null)}
        />
      )}

      {showMenu && (
        <GameMenuModal
          onQuit={() => { setShowMenu(false); finish(); }}
          onResume={() => setShowMenu(false)}
        />
      )}

      {timeIsUp && (
        <TimeUpModal
          score={currentScore}
          wordCount={found.length}
          onContinue={handleContinueFreePlay}
          onQuit={handleQuitAtTimeUp}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    height: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", padding: "1rem 0.5rem 1.25rem",
    boxSizing: "border-box",
  },
  titleRow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    marginBottom: "0.8rem", flexShrink: 0,
  },
  title: {
    margin: 0, fontSize: "1.7rem", fontWeight: 800, letterSpacing: "0.06em",
    background: "linear-gradient(90deg, #b39ddb, #f2a6c9, #fdf1d6)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  sparkle: { fontSize: "1.1rem" },
  statusCard: {
    width: "100%", maxWidth: 480, display: "flex", alignItems: "center",
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: "0.7rem 1rem", flexShrink: 0,
  },
  statusHalf: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" },
  statusDivider: { width: 1, alignSelf: "stretch", background: T.border },
  statusIcon: { fontSize: "1.1rem" },
  statusValue: { fontSize: "1.05rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.text },
  challengeSection: { width: "100%", maxWidth: 480, marginBottom: "0.6rem", flexShrink: 0 },
  histogramSection: { width: "100%", maxWidth: 480, margin: "0.5rem 0 1rem", flexShrink: 0 },
  histogramLabel: { color: T.muted, fontSize: "0.8rem", textAlign: "center", marginBottom: "0.5rem" },
  guessCenter: {
    flex: 1, width: "100%", maxWidth: 480, minHeight: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem",
  },
  cursor: {
    color: T.muted, fontWeight: 700, lineHeight: 1, fontSize: "3.2rem",
    animation: "skrammelBlink 1s steps(1, end) infinite",
  },
  guessRow: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  guessTile: {
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    color: T.tileText,
  },
  lastFound: { color: T.muted, fontSize: "0.9rem", fontWeight: 600, textAlign: "center" },
  bottomArea: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  feedback: {
    color: T.accent2, fontSize: "0.9rem", fontWeight: 600, textAlign: "center",
    minHeight: "1.3rem",
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
