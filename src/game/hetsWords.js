import { getDictionary } from "./wordList.js";
import { HETS_MAX_LENGTH_LOOKAHEAD } from "./hetsConstants.js";

let lengthIndex = null; // Map<längd, ord[]>, byggs en gång av dictionary

function buildLengthIndex() {
  const index = new Map();
  for (const word of getDictionary()) {
    const bucket = index.get(word.length);
    if (bucket) bucket.push(word);
    else index.set(word.length, [word]);
  }
  return index;
}

function shuffleLetters(word) {
  const letters = word.split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

// Plockar ett slumpat riktigt ord på exakt `length` bokstäver ur ordlistan
// och blandar dess bokstäver — ordet självt garanterar att minst ett giltigt
// svar finns bland de blandade bokstäverna. Om ordlistan (extremt ovanligt)
// saknar ord av exakt den längden letar vi uppåt upp till
// HETS_MAX_LENGTH_LOOKAHEAD steg, så en runda alltid går att generera.
export function generateHetsRound(length) {
  if (!lengthIndex) lengthIndex = buildLengthIndex();

  let n = length;
  let pool = lengthIndex.get(n);
  while ((!pool || pool.length === 0) && n < length + HETS_MAX_LENGTH_LOOKAHEAD) {
    n += 1;
    pool = lengthIndex.get(n);
  }
  if (!pool || pool.length === 0) return null;

  const word = pool[Math.floor(Math.random() * pool.length)];
  return { letters: shuffleLetters(word), length: word.length, word };
}
