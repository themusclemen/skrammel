import { getDictionary, isValidWord } from "./wordList.js";
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

function shuffleOnce(letters) {
  const result = [...letters];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const MAX_SHUFFLE_ATTEMPTS = 25;

// Blandar bokstäverna men undviker (bästa försök) att råka visa en ordning
// som redan stavar ett giltigt ord — VILKET som helst, inte bara källordet —
// annars skulle spelaren se facit direkt istället för en olöst gåta. Exporteras
// separat från generateHetsRound så samma regel gäller när "Blanda om"-knappen
// (se HetsGameScreen) visar en ny ordning på samma bokstäver.
export function shuffleLettersHidingWord(letters) {
  let attempt = shuffleOnce(letters);
  for (let i = 0; i < MAX_SHUFFLE_ATTEMPTS && isValidWord(attempt.join("")); i++) {
    attempt = shuffleOnce(letters);
  }
  return attempt;
}

// Plockar ett slumpat riktigt ord på exakt `length` bokstäver ur ordlistan
// och blandar dess bokstäver — ordet självt garanterar att minst ett giltigt
// svar finns bland de blandade bokstäverna. Om ordlistan (extremt ovanligt)
// saknar ord av exakt den längden letar vi uppåt upp till
// HETS_MAX_LENGTH_LOOKAHEAD steg, så en runda alltid går att generera.
// Provar upp till MAX_WORD_ATTEMPTS olika ord om shuffleLettersHidingWord
// ändå inte lyckas hitta en icke-ord-ordning (kan hända för korta ord där
// nästan alla permutationer råkar vara giltiga ord).
export function generateHetsRound(length) {
  if (!lengthIndex) lengthIndex = buildLengthIndex();

  let n = length;
  let pool = lengthIndex.get(n);
  while ((!pool || pool.length === 0) && n < length + HETS_MAX_LENGTH_LOOKAHEAD) {
    n += 1;
    pool = lengthIndex.get(n);
  }
  if (!pool || pool.length === 0) return null;

  const MAX_WORD_ATTEMPTS = 15;
  let lastAttempt = null;
  for (let w = 0; w < MAX_WORD_ATTEMPTS; w++) {
    const word = pool[Math.floor(Math.random() * pool.length)];
    const letters = shuffleLettersHidingWord(word.split(""));
    lastAttempt = { letters, length: word.length, word };
    if (!isValidWord(letters.join(""))) return lastAttempt;
  }
  // Extremt osannolikt (varje testat ords alla permutationer råkade vara
  // giltiga ord) — kör med sista försöket ändå istället för att fastna.
  return lastAttempt;
}
