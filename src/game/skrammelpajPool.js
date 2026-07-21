import { buildCandidatePool } from "./adminSuggest.js";
import { findWordsInSource } from "./findWords.js";
import {
  SKRAMMELPAJ_WORD_COUNT,
  SKRAMMELPAJ_MIN_TOTAL_LETTERS,
  SKRAMMELPAJ_MAX_TOTAL_LETTERS,
  SKRAMMELPAJ_MIN_FINDABLE,
  SKRAMMELPAJ_MAX_FINDABLE,
} from "./skrammelpajConstants.js";

const CANDIDATE_MIN_LENGTH = 4;
const CANDIDATE_MAX_LENGTH = 7;
const MAX_WORD_SET_ATTEMPTS = 200;
const MAX_POOL_ATTEMPTS = 20;

function shuffle(letters) {
  const result = [...letters];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Slumpar SKRAMMELPAJ_WORD_COUNT ord vars sammanlagda bokstavsantal hamnar i
// [SKRAMMELPAJ_MIN_TOTAL_LETTERS, SKRAMMELPAJ_MAX_TOTAL_LETTERS]. Rena
// försök-och-kasta — med 4-7-bokstavsord är träffchansen god nog för att
// slippa smartare kombinatorik.
function pickWordSet(candidatePool) {
  for (let i = 0; i < MAX_WORD_SET_ATTEMPTS; i++) {
    const words = [];
    let total = 0;
    for (let w = 0; w < SKRAMMELPAJ_WORD_COUNT; w++) {
      const word = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      words.push(word);
      total += word.length;
    }
    if (total >= SKRAMMELPAJ_MIN_TOTAL_LETTERS && total <= SKRAMMELPAJ_MAX_TOTAL_LETTERS) {
      return words;
    }
  }
  return null;
}

// Genererar en Skrammelpaj-pool: 4 slumpade ord, hopslagna och blandade till
// en bokstavssträng. Görs klient-sidigt (ingen kuraterad DB-tabell som
// Blixts blixt_words — kombinationer av 4 ord är för många för att kuratera
// i förväg), med en kvalitetskoll (findWordsInSource, samma multiset-
// matchning som redan används för att räkna formbara ord ur ett källord)
// som säkerställer att poolen ger ett rimligt antal spelbara ord.
export function generateSkrammelpajPool(dictionary) {
  const candidatePool = buildCandidatePool(dictionary, {
    minLength: CANDIDATE_MIN_LENGTH,
    maxLength: CANDIDATE_MAX_LENGTH,
  });

  let best = null;
  for (let i = 0; i < MAX_POOL_ATTEMPTS; i++) {
    const words = pickWordSet(candidatePool);
    if (!words) continue;
    const letters = shuffle(words.join("").split("")).join("");
    const findableCount = findWordsInSource(letters, dictionary).length;
    if (findableCount >= SKRAMMELPAJ_MIN_FINDABLE && findableCount <= SKRAMMELPAJ_MAX_FINDABLE) {
      return { letters, sourceWords: words, findableCount };
    }
    if (!best || findableCount > best.findableCount) {
      best = { letters, sourceWords: words, findableCount };
    }
  }
  return best;
}
