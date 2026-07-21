import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { T } from "../theme.js";
import { evaluateSkrammelpajMove, SkrammelpajGuessResult } from "../game/evaluateSkrammelpajGuess.js";
import { SKRAMMELPAJ_DURATION_SECONDS } from "../game/skrammelpajConstants.js";
import GameIntroModal from "../components/GameIntroModal.jsx";
import GameMenuModal from "../components/GameMenuModal.jsx";
import SkrammelpajLossModal from "../components/SkrammelpajLossModal.jsx";

const FEEDBACK_MESSAGES = {
  [SkrammelpajGuessResult.NOT_IN_POOL]: "Går inte att bilda av bokstäverna",
  [SkrammelpajGuessResult.NOT_A_WORD]: "Ej godkänt ord",
};

// Går igenom den URSPRUNGLIGA poolen i sin fasta ordning och markerar vilka
// positioner som redan är förbrukade av tidigare drag (både egna och
// motståndarens) — genom att "checka av" mot remainingCounts bokstav för
// bokstav. Vilken FYSISK position som räknas som förbrukad för en given
// bokstav spelar ingen roll (de är identiska), bara att rätt ANTAL blir det,
// så brickornas positioner håller sig stabila hela matchen istället för att
// hoppa runt (som de gjorde när gridden byggdes om från remainingCounts
// varje tur).
function deriveConsumed(originalLetters, remainingCounts) {
  const available = { ...remainingCounts };
  const consumed = new Set();
  originalLetters.forEach((letter, i) => {
    if ((available[letter] ?? 0) > 0) {
      available[letter] -= 1;
    } else {
      consumed.add(i);
    }
  });
  return consumed;
}

function totalLetters(counts) {
  return Object.values(counts).reduce((sum, n) => sum + Math.max(n, 0), 0);
}

// Spelar EN tur mot en given kvarvarande bokstavspool och rapporterar
// utfallet uppåt — anroparen avgör vad som händer sen (App.jsx för en
// riktig async-match: sparar draget och går till huben; SkrammelpajCpuScreen
// för en CPU-match: kör CPU:ns svar direkt och visar samma komponent igen
// för nästa tur). Ingen poäng, inget "hitta så många ord du kan" — bara
// bilda ETT ord innan tiden går ut.
//
// poolLetters är den URSPRUNGLIGA, oförändrade poolen (samma sträng hela
// matchen) — visas i sin helhet med redan förbrukade bokstäver gråtonade,
// så spelaren ser vad som är kvar OCH vad som redan är spelat, inte bara en
// krympande lista.
export default function SkrammelpajGameScreen({
  poolLetters, remainingCounts, opponentName, durationSeconds = SKRAMMELPAJ_DURATION_SECONDS,
  skipIntro = false, onSubmitWord, onTimeout, onGiveUp, onImpossible, onBack,
}) {
  const originalLetters = useMemo(() => poolLetters.split(""), [poolLetters]);
  const consumedIndices = useMemo(
    () => deriveConsumed(originalLetters, remainingCounts),
    [originalLetters, remainingCounts]
  );
  // Bara den bokstavligt TOMMA poolen avgör turen automatiskt — även om
  // inget ord går att bilda av det som finns kvar (t.ex. "XY") ska
  // spelaren ändå få se brickorna och försöka. Annars kändes det orättvist
  // abrupt att bli tillsagd "du förlorade" utan att ens få prova.
  const poolEmpty = totalLetters(remainingCounts) === 0;

  // I CPU-läget visas introt bara på första turen (varje efterföljande tur
  // är samma session, inte en ny — att förklara reglerna igen varje gång
  // vore bara friktion, till skillnad från en riktig async-match där varje
  // tur öppnas som en helt egen session, ofta dagar senare).
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [tappedIndices, setTappedIndices] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  // { reason, onContinue } — satt istället för att anropa onTimeout/
  // onImpossible direkt, så spelaren hinner se VARFÖR de förlorade innan
  // den faktiska DB-uppdateringen/navigeringen sker (samma roll som
  // BlixtTimeUpModal fyller för Blixt).
  const [lossModal, setLossModal] = useState(null);
  const resolvedRef = useRef(false);

  const tappedSet = useMemo(() => new Set(tappedIndices), [tappedIndices]);
  const isDisabled = useCallback((i) => consumedIndices.has(i) || tappedSet.has(i), [consumedIndices, tappedSet]);
  const currentWord = useMemo(
    () => tappedIndices.map((i) => originalLetters[i]).join(""),
    [tappedIndices, originalLetters]
  );
  const remainingCount = originalLetters.length - consumedIndices.size;

  // Poolen kan redan vara omöjlig när turen öppnas (motståndarens senaste
  // drag tömde ut det sista spelbara läget) — spelaren förlorar direkt
  // istället för att få en tur de aldrig kan vinna.
  useEffect(() => {
    if (poolEmpty && !resolvedRef.current) {
      resolvedRef.current = true;
      setLossModal({ reason: "no_words_left", onContinue: onImpossible });
    }
  }, [poolEmpty, onImpossible]);

  useEffect(() => {
    if (showIntro || poolEmpty) return;
    if (timeLeft <= 0) {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setLossModal({ reason: "timeout", onContinue: onTimeout });
      }
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, showIntro, poolEmpty, onTimeout]);

  const handleTileTap = (i) => {
    if (isDisabled(i)) return;
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

  const handleSubmit = useCallback(() => {
    if (tappedIndices.length === 0 || resolvedRef.current) return;
    const result = evaluateSkrammelpajMove(currentWord, remainingCounts);
    if (result.status === SkrammelpajGuessResult.OK) {
      resolvedRef.current = true;
      onSubmitWord(result.word);
    } else {
      setFeedback(FEEDBACK_MESSAGES[result.status]);
    }
  }, [currentWord, tappedIndices.length, remainingCounts, onSubmitWord]);

  useEffect(() => {
    if (showMenu || showIntro || poolEmpty) return;
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
        const idx = originalLetters.findIndex((l, i) => l === letter && !isDisabled(i));
        if (idx !== -1) handleTileTap(idx);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (poolEmpty) {
    return (
      <div style={styles.page}>
        {lossModal && <SkrammelpajLossModal reason={lossModal.reason} onContinue={lossModal.onContinue} />}
      </div>
    );
  }

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const isLowTime = timeLeft <= 30;
  const introMessage = opponentName
    ? `Din tur mot ${opponentName}! Bilda ett ord av kvarvarande bokstäver innan tiden går ut, annars förlorar du.`
    : "Bilda ett ord av kvarvarande bokstäver innan tiden går ut, annars förlorar du.";

  return (
    <div style={styles.page}>
      <div style={styles.titleRow}>
        <span style={styles.sparkle}>🥧</span>
        <h1 style={styles.title}>SKRAMMELPAJ</h1>
        <span style={styles.sparkle}>🥧</span>
      </div>

      <div style={styles.statusCard}>
        <span style={styles.statusIcon}>⏱</span>
        <span style={{ ...styles.statusValue, color: isLowTime ? T.accent2 : T.text }}>
          {minutes}:{seconds}
        </span>
      </div>

      <div style={styles.guessCenter}>
        {tappedIndices.length === 0 ? (
          <span style={styles.cursor}>_</span>
        ) : (
          <div style={styles.guessRow}>
            {tappedIndices.map((letterIdx, pos) => (
              <div key={pos} style={styles.guessTile}>{originalLetters[letterIdx]}</div>
            ))}
          </div>
        )}
        <div style={styles.feedback}>{feedback}</div>
      </div>

      <div style={styles.bottomArea}>
        <div style={styles.poolLabel}>{remainingCount} bokstäver kvar i poolen</div>
        <div style={styles.tileGrid}>
          {originalLetters.map((letter, i) => {
            const consumed = consumedIndices.has(i);
            const tapped = tappedSet.has(i);
            return (
              <button
                key={i}
                onClick={() => handleTileTap(i)}
                disabled={consumed || tapped}
                title={consumed ? "Redan använd" : undefined}
                style={{
                  ...styles.tile,
                  ...(consumed ? styles.tileConsumed : null),
                  ...(tapped ? styles.tileTapped : null),
                }}
              >
                {tapped ? "" : letter}
              </button>
            );
          })}
        </div>

        <div style={styles.controlsRow}>
          <button onClick={() => setShowMenu(true)} style={styles.iconButton} aria-label="Meny">…</button>
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

      {showMenu && !lossModal && (
        <GameMenuModal
          onQuit={() => { setShowMenu(false); resolvedRef.current = true; onGiveUp(); }}
          onResume={() => setShowMenu(false)}
        />
      )}

      {showIntro && !lossModal && (
        <GameIntroModal title="🥧 Skrammelpaj" message={introMessage} onStart={() => setShowIntro(false)} onBack={onBack} />
      )}

      {lossModal && <SkrammelpajLossModal reason={lossModal.reason} onContinue={lossModal.onContinue} />}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", padding: "1rem 0.5rem 1.25rem",
    boxSizing: "border-box",
  },
  titleRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.8rem" },
  title: {
    margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "0.06em",
    background: "linear-gradient(90deg, #d4ff3f, #7bd88f, #5fd0c4)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  sparkle: { fontSize: "1.1rem" },
  statusCard: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: "0.6rem 1.2rem",
  },
  statusIcon: { fontSize: "1.1rem" },
  statusValue: { fontSize: "1.2rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  guessCenter: {
    flex: 1, width: "100%", maxWidth: 480, minHeight: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem",
  },
  cursor: { color: T.muted, fontWeight: 700, lineHeight: 1, fontSize: "3.2rem" },
  guessRow: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" },
  guessTile: {
    width: "3rem", height: "3rem", display: "flex", alignItems: "center", justifyContent: "center",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 10, fontWeight: 700,
    fontSize: "1.4rem", color: T.tileText,
  },
  feedback: { color: T.accent2, fontSize: "0.9rem", fontWeight: 600, textAlign: "center", minHeight: "1.3rem" },
  bottomArea: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center" },
  poolLabel: { color: T.muted, fontSize: "0.8rem", marginBottom: "0.5rem" },
  tileGrid: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px", marginBottom: "0.5rem" },
  tile: {
    width: "2.6rem", height: "2.6rem", fontSize: "1.15rem",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: T.tile, border: `1px solid ${T.tileBorder}`, borderRadius: 8, fontWeight: 700,
    color: T.tileText, cursor: "pointer", padding: 0,
  },
  // Redan spelad i ett TIDIGARE drag — bokstaven syns fortfarande (gråtonad)
  // så spelaren kan se hela poolens historik, till skillnad från tileTapped.
  tileConsumed: {
    background: "transparent", border: `1px dashed ${T.tileEmptyBorder}`, color: T.muted, opacity: 0.45, cursor: "default",
  },
  // Vald för ordet man bygger just nu (visas redan i guessRow ovanför) —
  // tom bricka, samma som tidigare beteende.
  tileTapped: { background: T.tileEmpty, border: `1px dashed ${T.tileEmptyBorder}`, cursor: "default" },
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
};
