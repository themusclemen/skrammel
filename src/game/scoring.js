import { MIN_WORD_LENGTH } from "./constants.js";

export function isScorable(word) {
  return word.length >= MIN_WORD_LENGTH;
}

export function scoreForWord(word) {
  return word.length;
}

export function totalScore(words) {
  return words.reduce((sum, word) => sum + scoreForWord(word), 0);
}
