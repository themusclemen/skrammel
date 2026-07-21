import { useState, useMemo } from "react";
import { T } from "../theme.js";
import { getDictionary } from "../game/wordList.js";
import { letterCounts } from "../game/letters.js";
import { findWordsFromCounts } from "../game/findWords.js";
import { generateSkrammelpajPool } from "../game/skrammelpajPool.js";
import SkrammelpajGameScreen from "./SkrammelpajGameScreen.jsx";

const CPU_THINK_MS = 800;

function subtractWord(counts, word) {
  const next = { ...counts };
  for (const [letter, n] of Object.entries(letterCounts(word))) {
    next[letter] = (next[letter] ?? 0) - n;
  }
  return next;
}

// CPU-läge: en helt lokal, synkron variant av samma turordnings-loop som
// den riktiga async-matchen — ingen challenge-rad, inga drag i Supabase.
// Räknas därför aldrig till topplistan (bekräftat beslut: bara riktiga
// motspelare gör det). SkrammelpajGameScreen återanvänds rakt av för
// spelarens tur; CPU:ns "tur" löses direkt i den här komponenten.
export default function SkrammelpajCpuScreen({ onHome }) {
  const dictionary = getDictionary();
  const [pool] = useState(() => generateSkrammelpajPool(dictionary));
  const [moves, setMoves] = useState([]); // [{ who: "me" | "cpu", word }]
  const [cpuThinking, setCpuThinking] = useState(false);
  const [result, setResult] = useState(null); // { won, reason } | null

  const remainingCounts = useMemo(() => {
    let counts = letterCounts(pool?.letters ?? "");
    for (const move of moves) counts = subtractWord(counts, move.word);
    return counts;
  }, [pool, moves]);

  const finish = (won, reason) => setResult({ won, reason });

  const playCpuTurn = (countsAfterMyMove, movesAfterMyMove) => {
    const options = findWordsFromCounts(countsAfterMyMove, dictionary);
    if (options.length === 0) {
      finish(true, "no_words_left");
      return;
    }
    setCpuThinking(true);
    setTimeout(() => {
      const word = options[Math.floor(Math.random() * options.length)];
      const nextMoves = [...movesAfterMyMove, { who: "cpu", word }];
      const countsAfterCpu = subtractWord(countsAfterMyMove, word);
      setCpuThinking(false);
      setMoves(nextMoves);
      if (findWordsFromCounts(countsAfterCpu, dictionary).length === 0) {
        finish(false, "no_words_left");
      }
    }, CPU_THINK_MS);
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

  if (result) {
    return (
      <div style={styles.page}>
        <div style={styles.verdict}>{result.won ? "Du vann mot CPU! 🥧" : "CPU vann"}</div>
        <div style={{ color: T.muted, fontSize: "0.9rem" }}>
          {result.reason === "no_words_left"
            ? result.won ? "CPU hittade inget ord i poolen." : "Du hittade inget ord i poolen."
            : result.reason === "timeout"
            ? "Tiden tog slut."
            : "Du gav upp."}
        </div>
        <div style={styles.moveList}>
          {moves.map((m, i) => (
            <span key={i} style={{ ...styles.moveChip, ...(m.who === "me" ? styles.moveChipMine : null) }}>
              {m.who === "me" ? "Du" : "CPU"}: {m.word}
            </span>
          ))}
        </div>
        <button onClick={onHome} style={styles.navButton}>Till start</button>
      </div>
    );
  }

  if (cpuThinking) {
    return (
      <div style={styles.page}>
        <div style={styles.thinking}>🥧 CPU tänker…</div>
      </div>
    );
  }

  return (
    <SkrammelpajGameScreen
      key={moves.length}
      remainingCounts={remainingCounts}
      opponentName="CPU"
      skipIntro={moves.length > 0}
      onSubmitWord={handleSubmitWord}
      onTimeout={() => finish(false, "timeout")}
      onGiveUp={() => finish(false, "give_up")}
      onImpossible={() => finish(true, "no_words_left")}
      onBack={onHome}
    />
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "1rem", padding: "1.5rem", textAlign: "center",
  },
  verdict: { fontSize: "1.6rem", fontWeight: 800, color: T.accent },
  thinking: { color: T.muted, fontSize: "1.2rem", fontWeight: 700 },
  moveList: { display: "flex", flexWrap: "wrap", gap: "0.4rem", maxWidth: 360, justifyContent: "center" },
  moveChip: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "0.25rem 0.6rem", fontSize: "0.8rem", color: T.muted },
  moveChipMine: { borderColor: T.accent, color: T.accent },
  navButton: {
    padding: "0.7rem 1.2rem", borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, fontSize: "0.9rem", cursor: "pointer", marginTop: "0.5rem",
  },
};
