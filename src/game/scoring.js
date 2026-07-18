import { MIN_WORD_LENGTH, PANGRAM_BONUS } from "./constants.js";

export function isScorable(word) {
  return word.length >= MIN_WORD_LENGTH;
}

// Ett pangram använder alla bokstäver i källordet. canFormWord garanterar
// redan att ordet bara innehåller bokstäver som finns i källordet, så
// matchande längd räcker för att veta att alla bokstäver är förbrukade.
export function isPangram(word, sourceWord) {
  return word.length === sourceWord.length;
}

export function scoreForWord(word, sourceWord) {
  const base = word.length;
  return sourceWord && isPangram(word, sourceWord) ? base + PANGRAM_BONUS : base;
}

export function totalScore(words, sourceWord) {
  return words.reduce((sum, word) => sum + scoreForWord(word, sourceWord), 0);
}
