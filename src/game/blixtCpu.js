import { findWordsInSource } from "./findWords.js";
import { totalScore } from "./scoring.js";

// Blixt är inte turordning som Skrammelpajs CPU-läge (findWordsFromCounts
// + en simulerad "tur") — båda spelar hela sin runda oberoende av varandra
// mot samma källord. CPU:ns "resultat" behöver därför ingen simulering av
// själva spelandet, bara ett rimligt jämförelsetal: en slumpad delmängd av
// alla ord som faktiskt går att hitta, stor nog att motsvara mellan 25%
// och 65% av total möjlig poäng.
const CPU_MIN_PERCENT = 0.25;
const CPU_MAX_PERCENT = 0.65;

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
