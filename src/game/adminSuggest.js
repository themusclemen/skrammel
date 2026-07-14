import { findWordsInSource } from "./findWords.js";

const MIN_LENGTH = 7;
const MAX_LENGTH = 10;
const MIN_FINDABLE = 50;
const MAX_FINDABLE = 250;
const MAX_ATTEMPTS = 20;

// Kandidat-poolen (7–10 bokstäver) filtreras en gång och återanvänds för
// alla förslag, istället för att filtrera hela 70k-ordslistan varje gång.
export function buildCandidatePool(dictionary) {
  return [...dictionary].filter((w) => w.length >= MIN_LENGTH && w.length <= MAX_LENGTH);
}

// Slumpar fram ett källordsförslag och kollar hur många ord det ger via
// findWordsInSource. Försöker hitta ett förslag inom [MIN_FINDABLE,
// MAX_FINDABLE], men ger annars tillbaka det bästa den hann hitta.
export function suggestSourceWord(candidatePool, dictionary) {
  const target = (MIN_FINDABLE + MAX_FINDABLE) / 2;
  let best = null;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    const count = findWordsInSource(candidate, dictionary).length;
    if (count >= MIN_FINDABLE && count <= MAX_FINDABLE) {
      return { word: candidate, count };
    }
    if (!best || Math.abs(count - target) < Math.abs(best.count - target)) {
      best = { word: candidate, count };
    }
  }
  return best;
}
