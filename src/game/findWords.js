import { letterCounts, canFormWord } from "./letters.js";
import { MIN_WORD_LENGTH } from "./constants.js";

// Går igenom en ordlista och plockar ut alla ord (utom källordet självt) som
// går att bilda av källordets bokstäver. Används för kurering — t.ex. för att
// se hur många ord ett kandidat-källord ger innan det publiceras.
export function findWordsInSource(sourceWord, dictionary) {
  const source = sourceWord.trim().toUpperCase();
  const sourceCounts = letterCounts(source);
  const found = [];

  for (const word of dictionary) {
    if (word === source) continue;
    if (word.length < MIN_WORD_LENGTH || word.length > source.length) continue;
    if (canFormWord(word, sourceCounts)) found.push(word);
  }

  return found.sort((a, b) => b.length - a.length || a.localeCompare(b, "sv"));
}
