import { findWordsInSource } from "./findWords.js";

const MIN_LENGTH = 7;
const MAX_LENGTH = 10;
const MIN_FINDABLE = 50;
const MAX_FINDABLE = 250;
const MAX_ATTEMPTS = 20;

// Kandidat-poolen (7–10 bokstäver som default) filtreras en gång och
// återanvänds för alla förslag, istället för att filtrera hela
// 70k-ordslistan varje gång. Blixtpussel skickar { minLength: 6, maxLength: 6 }.
export function buildCandidatePool(dictionary, { minLength = MIN_LENGTH, maxLength = MAX_LENGTH } = {}) {
  return [...dictionary].filter((w) => w.length >= minLength && w.length <= maxLength);
}

// Slumpar fram ett källordsförslag och kollar hur många ord det ger via
// findWordsInSource. Försöker hitta ett förslag inom [minFindable,
// maxFindable] (default 50–250, Blixtpussel skickar 12–70), men ger annars
// tillbaka det bästa den hann hitta.
export function suggestSourceWord(candidatePool, dictionary, { minFindable = MIN_FINDABLE, maxFindable = MAX_FINDABLE } = {}) {
  const target = (minFindable + maxFindable) / 2;
  let best = null;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    const count = findWordsInSource(candidate, dictionary).length;
    if (count >= minFindable && count <= maxFindable) {
      return { word: candidate, count };
    }
    if (!best || Math.abs(count - target) < Math.abs(best.count - target)) {
      best = { word: candidate, count };
    }
  }
  return best;
}
