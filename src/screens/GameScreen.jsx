import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { T } from "../theme.js";
import { GAME_DURATION_SECONDS } from "../game/constants.js";
import { letterCounts } from "../game/letters.js";
import { evaluateGuess, GuessResult } from "../game/evaluateGuess.js";
import { totalScore } from "../game/scoring.js";
import { findWordsInSource } from "../game/findWords.js";
import { getDictionary } from "../game/wordList.js";
import { computeLevelTargets } from "../game/levels.js";
import { playClickSound, playFanfareSound, playPangramSound } from "../audio/sounds.js";
import WordLengthHistogram from "../components/WordLengthHistogram.jsx";
import ChallengeBar from "../components/ChallengeBar.jsx";
import WordLengthModal from "../components/WordLengthModal.jsx";
import GameMenuModal from "../components/GameMenuModal.jsx";
import TimeUpModal from "../components/TimeUpModal.jsx";
import WordRevealModal from "../components/WordRevealModal.jsx";
import GameIntroModal from "../components/GameIntroModal.jsx";
import BeatScoreBar from "../components/BeatScoreBar.jsx";

function groupByLength(words) {
  const counts = {};
  for (const word of words) counts[word.length] = (counts[word.length] ?? 0) + 1;
  return counts;
}

function groupWordsByLength(words) {
  const groups = {};
  for (const word of words) (groups[word.length] ??= []).push(word);
  return groups;
}

const MINUTE_WORDS = { 1: "en", 2: "två", 3: "tre", 4: "fyra", 5: "fem", 6: "sex", 7: "sju", 8: "åtta", 9: "nio", 10: "tio" };
function minutesWord(seconds) {
  const m = Math.round(seconds / 60);
  return MINUTE_WORDS[m] ?? String(m);
}

const FEEDBACK_MESSAGES = {
  [GuessResult.TOO_SHORT]: "Minst 2 bokstäver",
  [GuessResult.ALREADY_FOUND]: "Redan hittat",
  [GuessResult.IS_SOURCE_WORD]: "Hitta andra ord än källordet!",
  [GuessResult.NOT_IN_SOURCE]: "Finns inte i ordet",
  [GuessResult.NOT_A_WORD]: "Ej godkänt ord",
};

// Källradens brickor har konstant storlek oavsett ordlängd (7 eller 10
// bokstäver ska se lika stora ut). flex-basis sätter målstorleken; flex-shrink
// är bara en säkerhetsventil för smala skärmar där en oflippad 7-bokstavsrad
// annars skulle svämma över.
const SOURCE_TILE_SIZE = "3.8rem";
const SOURCE_TILE_FONT = "1.65rem";
const SOURCE_TILE_GAP = 8; // px

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

export default function GameScreen({
  sourceWord, onSubmitScore, onFinish, durationSeconds = GAME_DURATION_SECONDS, showLevelBar = true,
  targetScore = null, opponentName = null,
}) {
  const sourceLetters = useMemo(() => sourceWord.split(""), [sourceWord]);
  const sourceCounts = useMemo(() => letterCounts(sourceWord), [sourceWord]);
  // Ord på 8+ bokstäver delas på två rader så brickorna blir större och
  // lättare att trycka på. Vid udda antal blir andra raden längre.
  const tileRows = useMemo(() => {
    const n = sourceLetters.length;
    if (n < 8) return [sourceLetters.map((_, i) => i)];
    const firstLen = Math.floor(n / 2);
    return [
      sourceLetters.map((_, i) => i).slice(0, firstLen),
      sourceLetters.map((_, i) => i).slice(firstLen),
    ];
  }, [sourceLetters]);
  // Sant tills spelaren stänger den pedagogiska introt — klockan börjar
  // inte ticka och tangentbordsinput ignoreras medan den visas.
  const [showIntro, setShowIntro] = useState(true);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  // Ordnad lista av index i sourceWord som är intryckta för det ord som byggs just nu.
  const [tappedIndices, setTappedIndices] = useState([]);
  const [found, setFound] = useState([]); // [{ word, score }]
  const [feedback, setFeedback] = useState(null);
  const [modalLength, setModalLength] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showWordReveal, setShowWordReveal] = useState(false);
  const [timeIsUp, setTimeIsUp] = useState(false);
  // Sant när spelaren valt att fortsätta spela efter att tiden tog slut —
  // klockan döljs och räknas inte längre. Resultatet är redan sparat vid
  // det laget (se submitCurrentScore/timer-effekten nedan) oavsett vad
  // spelaren väljer, så fri spelning påverkar aldrig det sparade resultatet.
  const [freePlay, setFreePlay] = useState(false);
  // Idle-texten ("BILDA NYA ORD AV..." / "Kämpa :)") som scrollar där
  // gissningsprompten annars visas, tills spelaren skriver sin första
  // bokstav — sen är den förbrukad för resten av rundan, även om
  // spelaren raderar tillbaka till tomt.
  const [hasTypedOnce, setHasTypedOnce] = useState(false);
  const [idleTickerPast30s, setIdleTickerPast30s] = useState(false);
  const [idleTickerShowSecondary, setIdleTickerShowSecondary] = useState(false);
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
  const sourceWordList = useMemo(
    () => findWordsInSource(sourceWord, getDictionary()),
    [sourceWord]
  );
  const totalByLength = useMemo(() => groupByLength(sourceWordList), [sourceWordList]);
  const allWordsByLength = useMemo(() => groupWordsByLength(sourceWordList), [sourceWordList]);
  const foundByLength = useMemo(
    () => groupByLength(found.map((f) => f.word)),
    [found]
  );
  const currentScore = totalScore(found.map((f) => f.word), sourceWord);
  // Räknas via totalScore (inte bara längdsumman) så att eventuella
  // pangram bland de hittabara orden räknas med i maxpoängen — annars kunde
  // en spelare som hittar ett pangram gå förbi 100% av "det möjliga".
  const totalPossibleScore = useMemo(
    () => totalScore(sourceWordList, sourceWord),
    [sourceWordList, sourceWord]
  );
  const levelTargets = useMemo(
    () => computeLevelTargets(totalPossibleScore),
    [totalPossibleScore]
  );
  // Vilken tid (sekunder från spelstart) spelaren nådde varje nivå på —
  // { [nivånamn]: elapsedSeconds } — sparas med resultatet för framtida topplistor.
  const [levelTimes, setLevelTimes] = useState({});
  const [highlightLength, setHighlightLength] = useState(null);
  // Kort golden-glow-puls på bokstavsbrickorna när ett pangram hittas — se
  // handleSubmit. Rensas efter samma slags timeout som highlightLength.
  const [pangramPulse, setPangramPulse] = useState(false);
  const highlightTimeoutRef = useRef(null);
  const pangramTimeoutRef = useRef(null);
  const finishedRef = useRef(false);
  const submittedRef = useRef(false);

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);
  useEffect(() => () => clearTimeout(pangramTimeoutRef.current), []);

  useEffect(() => {
    if (tappedIndices.length > 0) setHasTypedOnce(true);
  }, [tappedIndices.length]);

  useEffect(() => {
    if (hasTypedOnce || showIntro) return;
    const id = setTimeout(() => setIdleTickerPast30s(true), 30000);
    return () => clearTimeout(id);
  }, [hasTypedOnce, showIntro]);

  const handleIdleTickerLoop = () => {
    if (idleTickerPast30s) setIdleTickerShowSecondary((v) => !v);
  };

  // Sparar resultatet — men bara första gången. Anropas dels direkt när
  // tiden går ut (oavsett vad spelaren sen väljer), dels från finish() om
  // spelaren avslutar innan dess (t.ex. via menyn). Det som eventuellt
  // hittas efter att tiden gått ut (fri spelning) påverkar aldrig det som
  // redan sparats, eftersom submittedRef då redan är satt.
  const submitCurrentScore = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmitScore(totalScore(found.map((f) => f.word), sourceWord), found.map((f) => f.word), levelTimes);
  }, [found, onSubmitScore, levelTimes, sourceWord]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    submitCurrentScore();
    onFinish(totalScore(found.map((f) => f.word), sourceWord), found.map((f) => f.word), totalPossibleScore);
  }, [found, onFinish, submitCurrentScore, sourceWord]);

  useEffect(() => {
    if (showIntro) return; // Klockan startar inte förrän spelaren stängt introt.
    if (freePlay) return; // Tiden räknas inte längre i fri spelning.
    if (timeLeft <= 0) {
      setTimeIsUp(true);
      submitCurrentScore();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, freePlay, showIntro, submitCurrentScore]);

  const handleQuitAtTimeUp = () => {
    setTimeIsUp(false);
    setShowWordReveal(true);
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
      if (result.pangram) {
        playPangramSound();
        setPangramPulse(true);
        clearTimeout(pangramTimeoutRef.current);
        pangramTimeoutRef.current = setTimeout(() => setPangramPulse(false), 1400);
      } else {
        playFanfareSound();
      }
      setFound((f) => [...f, { word: result.word, score: result.score, pangram: result.pangram }]);
      setTappedIndices([]);
      setFeedback(null);
      setHighlightLength(result.word.length);
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightLength(null), 1000);

      const newScore = currentScore + result.score;
      const elapsed = durationSeconds - timeLeft;
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
    if (showMenu || showWordReveal || timeIsUp || modalLength !== null || showIntro) return;
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

  // Introtexten beror på vilket läge rundan spelas i: dagens ord (klocka,
  // ingen fast motståndare), en ny blixt (ingen poäng att slå än — den
  // skickas som utmaning efteråt), eller svar på en blixtutmaning (fast
  // mål: motståndarens redan spelade resultat).
  const introMode = targetScore != null ? "blixt-respond" : !showLevelBar ? "blixt-new" : "daily";
  const introTitle = introMode === "daily" ? "Dagens Skrammel" : "⚡ Blixt";
  const introMessage =
    introMode === "blixt-respond"
      ? `Du har ${minutesWord(durationSeconds)} minuter på dig att slå ${opponentName}s resultat: ${targetScore} poäng!`
      : introMode === "blixt-new"
      ? `Du har ${minutesWord(durationSeconds)} minuter på dig att hitta så många ord som möjligt. Din poäng skickas som en utmaning till en vän!`
      : `Du har ${minutesWord(durationSeconds)} minuter på dig att hitta så många ord som möjligt av bokstäverna i "${sourceWord}". Ju längre ord, desto fler poäng!`;

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secondsPart = timeLeft % 60;
  const seconds = String(secondsPart).padStart(2, "0");
  // Klockan blinkar 10 sekunder kring varje hel minut som passeras
  // (t.ex. 5:00 ner till 4:50), inklusive vid spelstart.
  const isMinuteBlink = !freePlay && (secondsPart === 0 || secondsPart >= 50);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes skrammelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes skrammelMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @keyframes skrammelPangramGlow {
          0% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); }
          30% { box-shadow: 0 0 24px 6px rgba(255, 215, 0, 0.7); }
          100% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); }
        }
        .skrammel-btn {
          transition: transform 0.08s ease;
        }
        .skrammel-btn:active:not(:disabled) {
          transform: scale(0.94);
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
          <span style={{
            ...styles.statusValue,
            color: !freePlay && timeLeft <= 30 ? T.accent2 : T.text,
            animation: isMinuteBlink ? "skrammelBlink 1s steps(1, end) infinite" : "none",
          }}>
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
          hasTypedOnce ? (
            <span style={styles.cursor}>_</span>
          ) : (
            <div style={styles.idleTickerContainer}>
              <span style={styles.idleTickerText} onAnimationIteration={handleIdleTickerLoop}>
                {idleTickerShowSecondary ? "Kämpa :)" : `BILDA NYA ORD AV "${sourceWord}"`}
              </span>
            </div>
          )
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
            {lastFound.pangram && <span style={styles.pangramBadge}>🌟 PANGRAM! </span>}
            {lastFound.word} <span style={{ color: T.accent }}>+{lastFound.score}</span>
          </div>
        )}

        <div style={styles.feedback}>{feedback}</div>
      </div>

      <div style={styles.bottomArea}>
        {showLevelBar ? (
          <div style={styles.challengeSection}>
            <ChallengeBar currentScore={currentScore} levels={levelTargets} totalPossibleScore={totalPossibleScore} />
          </div>
        ) : targetScore != null ? (
          <div style={styles.challengeSection}>
            <BeatScoreBar currentScore={currentScore} targetScore={targetScore} opponentName={opponentName} />
          </div>
        ) : null}

        <div style={styles.histogramSection}>
          <div style={styles.histogramLabel}>Ord kvar</div>
          <WordLengthHistogram
            totalByLength={totalByLength}
            foundByLength={foundByLength}
            highlightLength={highlightLength}
            onSelectLength={setModalLength}
          />
        </div>

        <div
          style={{
            ...styles.tileRowsContainer,
            gap: `${SOURCE_TILE_GAP}px`,
            borderRadius: 16,
            animation: pangramPulse ? "skrammelPangramGlow 1.4s ease-out" : "none",
          }}
        >
          {tileRows.map((rowIndices, rowIdx) => (
            <div key={rowIdx} style={{ ...styles.tileRow, gap: `${SOURCE_TILE_GAP}px` }}>
              {rowIndices.map((i, posInRow) => {
                const letter = sourceLetters[i];
                const used = usedIndices.has(i);
                const isLastOfFirstRow =
                  rowIdx === 0 && tileRows.length > 1 && posInRow === rowIndices.length - 1;
                return (
                  <div key={i} style={styles.tileWrap}>
                    <button
                      data-tile-index={i}
                      className="skrammel-btn"
                      onClick={() => handleTileTap(i)}
                      disabled={used}
                      style={{
                        ...styles.tile,
                        ...(used ? styles.tileUsed : null),
                      }}
                    >
                      {used ? "" : letter}
                    </button>
                    {isLastOfFirstRow && <span style={styles.tileHyphen}>-</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={styles.controlsRow}>
          <button
            className="skrammel-btn"
            onClick={() => setShowMenu(true)}
            style={styles.iconButton}
            aria-label="Meny"
          >
            …
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
          onQuit={() => { setShowMenu(false); setShowWordReveal(true); }}
          onResume={() => setShowMenu(false)}
        />
      )}

      {showWordReveal && (
        <WordRevealModal
          wordsByLength={allWordsByLength}
          foundWords={foundWords}
          onContinue={() => { setShowWordReveal(false); finish(); }}
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

      {showIntro && (
        <GameIntroModal title={introTitle} message={introMessage} onStart={() => setShowIntro(false)} />
      )}
    </div>
  );
}

// touchAction: "manipulation" hindrar mobilwebbläsare från att vänta för att
// avgöra om ett tryck är en dubbeltryckning (zoom) eller vill scrolla — utan
// den kan ett lätt fingerskift under trycket få klicket att helt utebli,
// vilket är den troliga orsaken bakom "lynniga" bokstavsbrickor.
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
  idleTickerContainer: { width: "100%", overflow: "hidden", whiteSpace: "nowrap" },
  idleTickerText: {
    display: "inline-block", paddingLeft: "100%",
    fontWeight: 700, letterSpacing: "0.03em", fontSize: "2.6rem",
    background: "linear-gradient(90deg, #ff5252, #ffb347, #fff176, #7bd88f, #64b5f6, #b39ddb, #ff5252)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent",
    animation: "skrammelMarquee 9s linear infinite",
  },
  guessRow: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  guessTile: {
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    color: T.tileText,
  },
  lastFound: { color: T.muted, fontSize: "0.9rem", fontWeight: 600, textAlign: "center" },
  pangramBadge: { color: "#ffd700", fontWeight: 800 },
  bottomArea: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  feedback: {
    color: T.accent2, fontSize: "0.9rem", fontWeight: 600, textAlign: "center",
    minHeight: "1.3rem",
  },
  tileRowsContainer: { display: "flex", flexDirection: "column", width: "100%", alignItems: "center" },
  tileRow: {
    display: "flex", flexWrap: "nowrap", width: "100%", justifyContent: "center",
  },
  // Positionerad absolut, utanför flödet, så den inte påverkar hur raden
  // centreras — annars blir raden med bindestrecket omedelbart osymmetrisk
  // jämfört med raden utan.
  tileHyphen: {
    position: "absolute", right: "-1.4rem", top: "50%", transform: "translateY(-50%)",
    fontWeight: 800, color: T.text, fontSize: SOURCE_TILE_FONT, lineHeight: 1,
    pointerEvents: "none", userSelect: "none",
  },
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
  submitButton: {
    flex: 1, height: "2.8rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "1.05rem", cursor: "pointer",
    ...INTERACTIVE_STYLE,
  },
  tileWrap: {
    flex: `0 1 ${SOURCE_TILE_SIZE}`, minWidth: 0, position: "relative",
  },
  tile: {
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
