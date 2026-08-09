import { findWordsInSource } from "./findWords.js";
import { totalScore } from "./scoring.js";

// Blixt är inte turordning som Skrammelpajs CPU-läge (findWordsFromCounts
// + en simulerad "tur") — båda spelar hela sin runda oberoende av varandra
// mot samma källord. CPU:ns "resultat" behöver därför ingen simulering av
// själva spelandet, bara ett rimligt jämförelsetal: en slumpad delmängd av
// alla ord som faktiskt går att hitta.
//
// Intervallet är kalibrerat mot verkliga Blixt-resultat (65 riktiga rundor
// i skrammel-beta, 2026-08-09): riktiga poäng låg på 0–48 % av ordets
// totalt möjliga poäng, median 22,6 %, mittersta hälften 18–30 %. De gamla
// 25–65 % var istället lånade från dagens-ordets svåraste nivåer
// (GUD/LEGENDARISK i constants.js) — långt över vad en riktig spelare
// faktiskt hinner hitta på 2 minuter, så CPU:n vann i princip alltid.
// 18–30 % matchar en medelmåttig spelares faktiska prestation, så en
// genomsnittlig spelare har en verklig chans att vinna.
const CPU_MIN_PERCENT = 0.18;
const CPU_MAX_PERCENT = 0.30;

export function generateBlixtCpuResult(sourceWord, dictionary) {
  const findable = findWordsInSource(sourceWord, dictionary);
  const totalPossible = totalScore(findable, sourceWord);
  const targetPercent = CPU_MIN_PERCENT + Math.random() * (CPU_MAX_PERCENT - CPU_MIN_PERCENT);
  const targetScore = Math.round(totalPossible * targetPercent);

  const shuffled = [...findable].sort(() => Math.random() - 0.5);
  const words = [];
  let score = 0;
  for (const word of shuffled) {
    if (score >= targetScore) break;
    words.push(word);
    score = totalScore(words, sourceWord);
  }
  return { score, words };
}
