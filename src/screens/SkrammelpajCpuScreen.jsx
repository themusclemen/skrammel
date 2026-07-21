import { useState, useMemo, useEffect, useRef } from "react";
import { T } from "../theme.js";
import { getDictionary } from "../game/wordList.js";
import { letterCounts } from "../game/letters.js";
import { findWordsFromCounts } from "../game/findWords.js";
import { generateSkrammelpajPool } from "../game/skrammelpajPool.js";
import SkrammelpajGameScreen from "./SkrammelpajGameScreen.jsx";

// CPU:ns "betänketid" innan den bestämt sig — slumpad inom ett intervall så
// det inte känns robotmässigt fastställt, och tydligt längre än innan (var
// 800ms rakt av) så spelaren hinner uppfatta att något händer.
const CPU_THINK_MIN_MS = 1800;
const CPU_THINK_MAX_MS = 3200;
// Hur ofta jitter-animationen och bokstavsscramblet uppdateras.
const TICK_MS = 220;
// Hur lång tid mellan att varje bokstav i det valda ordet "låser sig" på
// plats, vänster till höger — ger en avkodnings-/typewriter-känsla istället
// för att ordet bara dyker upp på en gång.
const REVEAL_LOCK_MS = 260;
// Hur länge det klara ordet står kvar, tydligt läsbart, innan turen går
// vidare — det här är precisen "jag hann inte se vilket ord CPU valde".
const REVEAL_HOLD_MS = 1400;

const THINKING_CAPTIONS = [
  "Funderar…", "Provar bokstavskombinationer…", "Väger orden mot varandra…", "Nästan klar…",
];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";

function subtractWord(counts, word) {
  const next = { ...counts };
  for (const [letter, n] of Object.entries(letterCounts(word))) {
    next[letter] = (next[letter] ?? 0) - n;
  }
  return next;
}

function totalLetters(counts) {
  return Object.values(counts).reduce((sum, n) => sum + Math.max(n, 0), 0);
}

function expandCounts(counts) {
  const letters = [];
  for (const [letter, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) letters.push(letter);
  }
  return letters.sort((a, b) => a.localeCompare(b, "sv"));
}

// CPU-läge: en helt lokal, synkron variant av samma turordnings-loop som
// den riktiga async-matchen — ingen challenge-rad, inga drag i Supabase.
// Räknas därför aldrig till topplistan. SkrammelpajGameScreen återanvänds
// rakt av för spelarens tur; CPU:ns "tur" animeras och löses i den här
// komponenten (phase: "playing" -> "thinking" -> "revealing" -> "playing").
export default function SkrammelpajCpuScreen({ onHome }) {
  const dictionary = getDictionary();
  const [pool] = useState(() => generateSkrammelpajPool(dictionary));
  const [moves, setMoves] = useState([]); // [{ who: "me" | "cpu", word }]
  const [phase, setPhase] = useState("playing"); // "playing" | "thinking" | "revealing" | "result"
  const [pendingCpuWord, setPendingCpuWord] = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState(null); // { won, reason } | null
  const mountedRef = useRef(true);
  const timeoutsRef = useRef([]);

  useEffect(() => () => {
    mountedRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
  }, []);

  const runLater = (fn, ms) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timeoutsRef.current.push(id);
  };

  // Driver jitter-animationen på poolens brickor och bokstavsscramblet i
  // reveal-fasen — bara en periodisk omritning, ingen egen logik.
  useEffect(() => {
    if (phase !== "thinking" && phase !== "revealing") return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  const remainingCounts = useMemo(() => {
    let counts = letterCounts(pool?.letters ?? "");
    for (const move of moves) counts = subtractWord(counts, move.word);
    return counts;
  }, [pool, moves]);

  const thinkingLetters = useMemo(() => expandCounts(remainingCounts), [remainingCounts]);

  // emptied = poolen är helt tom (motståndaren tog bokstavligen sista
  // bokstaven), inte bara "inget formbart ord kvar trots bokstäver kvar" —
  // skiljer på "CPU vann, eftersom den tog sista bokstaven!" och det mer
  // generiska "hittade inget ord".
  const finish = (won, reason, emptied = false) => setResult({ won, reason, emptied });

  const playCpuTurn = (countsAfterMyMove, movesAfterMyMove) => {
    const options = findWordsFromCounts(countsAfterMyMove, dictionary);
    if (options.length === 0) {
      finish(true, "no_words_left", totalLetters(countsAfterMyMove) === 0);
      return;
    }
    const word = options[Math.floor(Math.random() * options.length)];
    setPhase("thinking");
    setPendingCpuWord(null);
    setRevealedCount(0);

    const thinkMs = CPU_THINK_MIN_MS + Math.random() * (CPU_THINK_MAX_MS - CPU_THINK_MIN_MS);
    runLater(() => {
      setPendingCpuWord(word);
      setPhase("revealing");
      lockNextLetter(word, 0, countsAfterMyMove, movesAfterMyMove);
    }, thinkMs);
  };

  // Låser en bokstav i taget i det valda ordet (vänster till höger), och
  // avslutar CPU:ns tur med en kort paus när hela ordet är synligt — det är
  // den pausen som gör att spelaren faktiskt hinner läsa vad CPU spelade.
  const lockNextLetter = (word, count, countsAfterMyMove, movesAfterMyMove) => {
    runLater(() => {
      const next = count + 1;
      setRevealedCount(next);
      if (next < word.length) {
        lockNextLetter(word, next, countsAfterMyMove, movesAfterMyMove);
        return;
      }
      runLater(() => {
        const countsAfterCpu = subtractWord(countsAfterMyMove, word);
        const nextMoves = [...movesAfterMyMove, { who: "cpu", word }];
        setMoves(nextMoves);
        setPhase("playing");
        setPendingCpuWord(null);
        // Avgör matchen direkt bara om poolen bokstavligen är tom — finns
        // det bokstäver kvar (hur omöjliga de än ser ut) ska spelaren
        // alltid få sin tur och försöka; SkrammelpajGameScreen visar då
        // brickorna som vanligt istället för att hoppa över turen.
        if (totalLetters(countsAfterCpu) === 0) {
          finish(false, "no_words_left", true);
        }
      }, REVEAL_HOLD_MS);
    }, REVEAL_LOCK_MS);
  };

  const handleSubmitWord = (word) => {
    const nextMoves = [...moves, { who: "me", word }];
    const countsAfterMyMove = subtractWord(remainingCounts, word);
    setMoves(nextMoves);
    playCpuTurn(countsAfterMyMove, nextMoves);
  };

  if (!pool) {
    return (
      <div style={styles.page}>
        <div style={{ color: T.muted }}>Kunde inte hitta en bra bokstavspool just nu — försök igen.</div>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    );
  }

  const moveHistory = moves.length > 0 && (
    <div style={styles.historyBar}>
      {moves.map((m, i) => (
        <span key={i} style={{ ...styles.moveChip, ...(m.who === "me" ? styles.moveChipMine : styles.moveChipCpu) }}>
          {m.who === "me" ? "Du" : "CPU"}: {m.word}
        </span>
      ))}
    </div>
  );

  // Rullbar enradsrad ovanför spelytan under själva turen — inte "fixed"
  // längst ner, det skulle täcka SkrammelpajGameScreens egna knappar
  // (RENSA/←/OK).
  const historyStrip = moves.length > 0 && (
    <div style={styles.historyStrip}>
      {moves.map((m, i) => (
        <span key={i} style={{ ...styles.moveChip, ...styles.moveChipNoWrap, ...(m.who === "me" ? styles.moveChipMine : styles.moveChipCpu) }}>
          {m.who === "me" ? "Du" : "CPU"}: {m.word}
        </span>
      ))}
    </div>
  );

  if (result) {
    const verdict = result.emptied
      ? result.won ? "Du vann, eftersom du tog sista bokstaven! 🥧" : "CPU vann, eftersom den tog sista bokstaven!"
      : result.won ? "Du vann mot CPU! 🥧" : "CPU vann";
    const reasonText = result.emptied
      ? null
      : result.reason === "no_words_left"
      ? result.won ? "CPU hittade inget ord i poolen." : "Du hittade inget ord i poolen."
      : result.reason === "timeout"
      ? "Tiden tog slut."
      : "Du gav upp.";

    return (
      <div style={styles.page}>
        <div style={styles.verdict}>{verdict}</div>
        {reasonText && <div style={{ color: T.muted, fontSize: "0.9rem" }}>{reasonText}</div>}
        {moveHistory}
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    );
  }

  if (phase === "thinking" || phase === "revealing") {
    const caption = phase === "thinking"
      ? THINKING_CAPTIONS[Math.floor(tick / 3) % THINKING_CAPTIONS.length]
      : "CPU spelade:";

    return (
      <div style={styles.page}>
        <style>{`
          @keyframes skrammelpajJitter {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-3px, 2px) rotate(-4deg); }
            50% { transform: translate(3px, -3px) rotate(3deg); }
            75% { transform: translate(-2px, -1px) rotate(-2deg); }
          }
          @keyframes skrammelpajPop {
            0% { transform: scale(0.4); opacity: 0; }
            60% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes skrammelpajPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>

        <div style={{ ...styles.thinking, animation: phase === "thinking" ? "skrammelpajPulse 1.4s ease-in-out infinite" : "none" }}>
          🥧 {caption}
        </div>

        {phase === "thinking" ? (
          <div style={styles.tileGrid}>
            {thinkingLetters.map((letter, i) => (
              <div
                key={i}
                style={{
                  ...styles.thinkTile,
                  animation: "skrammelpajJitter 0.6s ease-in-out infinite",
                  animationDelay: `${((i * 137) % 600) / 1000}s`,
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.tileGrid}>
            {pendingCpuWord.split("").map((letter, i) => {
              const locked = i < revealedCount;
              const scrambled = ALPHABET[(tick * 3 + i * 5) % ALPHABET.length];
              return (
                <div
                  key={i}
                  style={{
                    ...styles.thinkTile,
                    ...(locked ? styles.lockedTile : styles.scrambleTile),
                    animation: locked ? "skrammelpajPop 0.3s ease-out" : "none",
                  }}
                >
                  {locked ? letter : scrambled}
                </div>
              );
            })}
          </div>
        )}

        {moveHistory}
      </div>
    );
  }

  return (
    <div style={styles.cpuWrap}>
      {historyStrip}
      <SkrammelpajGameScreen
        key={moves.length}
        poolLetters={pool.letters}
        remainingCounts={remainingCounts}
        opponentName="CPU"
        skipIntro={moves.length > 0}
        onSubmitWord={handleSubmitWord}
        onTimeout={() => finish(false, "timeout")}
        onGiveUp={() => finish(false, "give_up")}
        onImpossible={() => finish(true, "no_words_left", totalLetters(remainingCounts) === 0)}
        onBack={onHome}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1rem", padding: "1.5rem", textAlign: "center",
  },
  cpuWrap: { position: "relative" },
  verdict: { fontSize: "1.6rem", fontWeight: 800, color: T.accent },
  thinking: { color: T.text, fontSize: "1.25rem", fontWeight: 700 },
  tileGrid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", maxWidth: 420 },
  thinkTile: {
    width: "2.8rem", height: "2.8rem", display: "flex", alignItems: "center", justifyContent: "center",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    fontSize: "1.2rem", color: T.tileText,
  },
  scrambleTile: { background: T.tileEmpty, borderColor: T.tileEmptyBorder, color: T.muted },
  lockedTile: { background: T.accent, borderColor: T.accent, color: "#121212" },
  historyBar: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 420, justifyContent: "center" },
  historyStrip: {
    display: "flex", flexWrap: "nowrap", gap: "0.4rem", overflowX: "auto",
    padding: "0.5rem 0.75rem", borderBottom: `1px solid ${T.border}`, background: T.bg,
  },
  moveChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.8rem", color: T.muted },
  moveChipNoWrap: { flexShrink: 0, whiteSpace: "nowrap" },
  moveChipMine: { borderColor: T.accent, color: T.accent },
  moveChipCpu: { borderColor: T.accent2, color: T.accent2 },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer", marginTop: "0.5rem",
  },
};
