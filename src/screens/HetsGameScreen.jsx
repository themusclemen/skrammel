import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { T } from "../theme.js";
import { HETS_MIN_LETTERS, HETS_ROUND_DURATION_SECONDS } from "../game/hetsConstants.js";
import { generateHetsRound, shuffleLettersHidingWord } from "../game/hetsWords.js";
import { evaluateHetsGuess, HetsGuessResult } from "../game/evaluateHetsGuess.js";
import { playClickSound, playFanfareSound } from "../audio/sounds.js";

const FEEDBACK_MESSAGES = {
  [HetsGuessResult.WRONG_LENGTH]: "Använd alla bokstäverna",
  [HetsGuessResult.NOT_IN_LETTERS]: "Finns inte i bokstäverna",
  [HetsGuessResult.NOT_A_WORD]: "Ej godkänt ord",
};

const SOURCE_TILE_SIZE = "3.8rem";
const SOURCE_TILE_FONT = "1.65rem";
const SOURCE_TILE_GAP = 8; // px

// Delar upp bokstäverna på två rader vid 8+ (samma tröskel som GameScreen)
// så brickorna hålls tillräckligt stora för att trycka på ju längre rundorna blir.
function tileRowsFor(letters) {
  const n = letters.length;
  const indices = letters.map((_, i) => i);
  if (n < 8) return [indices];
  const firstLen = Math.floor(n / 2);
  return [indices.slice(0, firstLen), indices.slice(firstLen)];
}

export default function HetsGameScreen({ personalBest, loggedIn, onFinish, onBack }) {
  const [round, setRound] = useState(() => generateHetsRound(HETS_MIN_LETTERS));
  const [timeLeft, setTimeLeft] = useState(HETS_ROUND_DURATION_SECONDS);
  const [tappedIndices, setTappedIndices] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [highestCompletedLength, setHighestCompletedLength] = useState(0);
  const [justSolvedLength, setJustSolvedLength] = useState(null);
  const [sessionStartedAt] = useState(() => Date.now());
  const finishedRef = useRef(false);
  const solvedTimeoutRef = useRef(null);
  // Tiden som räknas är fram till den SENAST klarade rundan, inte fram till
  // att spelaren faktiskt föll — annars skulle tiden man slösar på en runda
  // man ändå inte klarar (t.ex. hela rundans tid bommat på 8 bokstäver efter
  // att ha klarat 7) orättvist straffa tiebreaken för ett resultat man redan
  // uppnått. Uppdateras i processGuess vid varje lyckad runda.
  const lastSuccessElapsedRef = useRef(0);

  useEffect(() => () => clearTimeout(solvedTimeoutRef.current), []);

  const tileRows = useMemo(() => tileRowsFor(round?.letters ?? []), [round]);
  const usedIndices = useMemo(() => new Set(tappedIndices), [tappedIndices]);
  const currentWord = useMemo(
    () => tappedIndices.map((i) => round?.letters[i]).join(""),
    [tappedIndices, round]
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish({
      highestCompletedLength,
      totalTimeMs: lastSuccessElapsedRef.current,
      revealWord: round?.word ?? null,
    });
  }, [onFinish, highestCompletedLength, round]);

  useEffect(() => {
    if (timeLeft <= 0) {
      finish();
      return;
    }
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

  const handleReshuffle = () => {
    setRound((prev) => prev && { ...prev, letters: shuffleLettersHidingWord(prev.letters) });
    setTappedIndices([]);
    setFeedback(null);
  };

  // Gissningen prövas automatiskt så fort ALLA bokstäver är intryckta —
  // spelaren ska inte behöva trycka Enter/OK när ordet redan är rätt (eller
  // fel; en full uppsättning bokstäver är alltid en färdig gissning, det
  // finns inget "halvfärdigt" läge att pausa i).
  const processGuess = (word) => {
    const result = evaluateHetsGuess(word, round.letters);
    if (result.status === HetsGuessResult.OK) {
      playFanfareSound();
      const completedLength = round.length;
      lastSuccessElapsedRef.current = Date.now() - sessionStartedAt;
      setHighestCompletedLength(completedLength);
      setJustSolvedLength(completedLength);
      clearTimeout(solvedTimeoutRef.current);
      solvedTimeoutRef.current = setTimeout(() => setJustSolvedLength(null), 900);

      const next = generateHetsRound(completedLength + 1);
      if (!next) {
        finish();
        return;
      }
      setRound(next);
      setTappedIndices([]);
      setFeedback(null);
      setTimeLeft(HETS_ROUND_DURATION_SECONDS);
    } else {
      setFeedback(FEEDBACK_MESSAGES[result.status]);
      setTappedIndices([]);
    }
  };

  // Körs efter varje render (inga deps, samma mönster som tangentbords-
  // effekten nedan) och triggar bara när tappedIndices faktiskt precis nått
  // full längd — processGuess nollställer alltid tappedIndices, så villkoret
  // blir falskt igen på nästa render och kan inte trigga två gånger i rad.
  useEffect(() => {
    if (round && tappedIndices.length > 0 && tappedIndices.length === round.letters.length) {
      processGuess(currentWord);
    }
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key.length === 1 && round) {
        const letter = e.key.toUpperCase();
        const idx = round.letters.findIndex((l, i) => l === letter && !usedIndices.has(i));
        if (idx !== -1) handleTileTap(idx);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!round) {
    return (
      <div style={styles.page}>
        <div style={{ color: T.muted }}>Kunde inte starta en runda just nu. Försök igen senare.</div>
        <button onClick={onBack} style={styles.navButton}>Till start</button>
      </div>
    );
  }

  const recordLength = personalBest?.best_length ?? 0;
  const newRecord = highestCompletedLength > recordLength;
  const recordLine = !loggedIn
    ? null
    : newRecord
    ? "🔥 Nytt rekord!"
    : personalBest
    ? `🏆 Ditt bästa: ${recordLength} bokstäver`
    : "Sätt ditt första rekord!";

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes hetsBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .skrammel-btn { transition: transform 0.08s ease; }
        .skrammel-btn:active:not(:disabled) { transform: scale(0.94); }
      `}</style>

      <div style={styles.titleRow}>
        <span style={styles.sparkle}>🔥</span>
        <h1 style={styles.title}>HETS</h1>
        <span style={styles.sparkle}>🔥</span>
      </div>

      <div style={styles.statusCard}>
        <div style={styles.statusHalf}>
          <span style={styles.statusIcon}>⏱</span>
          <span style={{
            ...styles.statusValue,
            color: timeLeft <= 5 ? T.accent2 : T.text,
            animation: timeLeft <= 5 ? "hetsBlink 0.6s steps(1, end) infinite" : "none",
          }}>
            {timeLeft}s
          </span>
        </div>
        <div style={styles.statusDivider} />
        <div style={styles.statusHalf}>
          <span style={styles.statusIcon}>🔤</span>
          <span style={styles.statusValue}>{round.length} bokstäver</span>
        </div>
      </div>

      {recordLine && <div style={styles.recordLine}>{recordLine}</div>}

      <div style={styles.guessCenter}>
        {tappedIndices.length === 0 ? (
          <span style={styles.cursor}>_</span>
        ) : (
          <div style={styles.guessRow}>
            {tappedIndices.map((sourceIdx, pos) => (
              <div key={pos} style={styles.guessTile}>{round.letters[sourceIdx]}</div>
            ))}
          </div>
        )}

        {justSolvedLength !== null && (
          <div style={styles.solvedBadge}>✅ {justSolvedLength} bokstäver klara!</div>
        )}

        <div style={styles.feedback}>{feedback}</div>
      </div>

      <div style={styles.bottomArea}>
        <div style={{ ...styles.tileRowsContainer, gap: `${SOURCE_TILE_GAP}px` }}>
          {tileRows.map((rowIndices, rowIdx) => (
            <div key={rowIdx} style={{ ...styles.tileRow, gap: `${SOURCE_TILE_GAP}px` }}>
              {rowIndices.map((i) => {
                const letter = round.letters[i];
                const used = usedIndices.has(i);
                return (
                  <button
                    key={i}
                    className="skrammel-btn"
                    onClick={() => handleTileTap(i)}
                    disabled={used}
                    style={{ ...styles.tile, ...(used ? styles.tileUsed : null) }}
                  >
                    {used ? "" : letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={styles.controlsRow}>
          <button className="skrammel-btn" onClick={finish} style={styles.iconButton} aria-label="Avsluta">
            ✕
          </button>
          <button
            className="skrammel-btn"
            onClick={handleClearAll}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.clearAllButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
          >
            RENSA
          </button>
          <button
            className="skrammel-btn"
            onClick={handleBackspace}
            disabled={tappedIndices.length === 0}
            style={{ ...styles.iconButton, opacity: tappedIndices.length === 0 ? 0.4 : 1 }}
            aria-label="Ta bort sista bokstaven"
          >
            ←
          </button>
          <button
            className="skrammel-btn"
            onClick={handleReshuffle}
            style={styles.shuffleButton}
            aria-label="Blanda om bokstäverna"
          >
            🔀 Blanda
          </button>
        </div>
      </div>
    </div>
  );
}

const INTERACTIVE_STYLE = {
  touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
  userSelect: "none", WebkitUserSelect: "none",
};

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
    background: "linear-gradient(90deg, #ff5c4d, #ffb347, #d4ff3f)",
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
  recordLine: { marginTop: "0.5rem", color: T.accent, fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 },
  guessCenter: {
    flex: 1, width: "100%", maxWidth: 480, minHeight: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem",
  },
  cursor: { color: T.muted, fontWeight: 700, lineHeight: 1, fontSize: "3.2rem", animation: "hetsBlink 1s steps(1, end) infinite" },
  guessRow: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "8px" },
  guessTile: {
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    width: "3rem", height: "3rem", fontSize: "1.4rem",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    color: T.tileText,
  },
  solvedBadge: { color: T.accent, fontWeight: 700, fontSize: "0.95rem" },
  bottomArea: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  feedback: { color: T.accent2, fontSize: "0.9rem", fontWeight: 600, textAlign: "center", minHeight: "1.3rem" },
  tileRowsContainer: { display: "flex", flexDirection: "column", width: "100%", alignItems: "center" },
  tileRow: { display: "flex", flexWrap: "nowrap", width: "100%", justifyContent: "center" },
  controlsRow: { display: "flex", gap: "0.6rem", width: "100%", marginTop: "0.8rem" },
  iconButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontWeight: 700, fontSize: "1.3rem", cursor: "pointer", padding: 0,
    ...INTERACTIVE_STYLE,
  },
  clearAllButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontWeight: 600, fontSize: "1rem", cursor: "pointer",
    ...INTERACTIVE_STYLE,
  },
  shuffleButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1.05rem", cursor: "pointer",
    ...INTERACTIVE_STYLE,
  },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer", marginTop: "1rem",
  },
  tile: {
    flex: `0 1 ${SOURCE_TILE_SIZE}`, minWidth: 0,
    width: "100%", height: SOURCE_TILE_SIZE, fontSize: SOURCE_TILE_FONT,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    color: T.tileText, cursor: "pointer", padding: 0,
    ...INTERACTIVE_STYLE,
  },
  tileUsed: {
    background: T.tileEmpty, border: `1px dashed ${T.tileEmptyBorder}`, cursor: "default",
  },
};
