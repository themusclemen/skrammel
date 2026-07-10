import { canFormWord } from "./letters.js";
import { isValidWord } from "./wordList.js";
import { isScorable, scoreForWord } from "./scoring.js";

export const GuessResult = {
  OK: "ok",
  TOO_SHORT: "too_short",
  ALREADY_FOUND: "already_found",
  IS_SOURCE_WORD: "is_source_word",
  NOT_IN_SOURCE: "not_in_source",
  NOT_A_WORD: "not_a_word",
};

// sourceWord skickas in separat från sourceCounts (multisetet) eftersom vi
// annars inte kan avgöra att gissningen är exakt källordet självt — spelet
// går ut på att hitta ANDRA ord, inte återge källordet oförändrat.
export function evaluateGuess(rawWord, sourceWord, sourceCounts, alreadyFound) {
  const word = rawWord.trim().toUpperCase();

  if (!isScorable(word)) return { status: GuessResult.TOO_SHORT, word };
  if (alreadyFound.has(word)) return { status: GuessResult.ALREADY_FOUND, word };
  if (word === sourceWord.toUpperCase()) return { status: GuessResult.IS_SOURCE_WORD, word };
  if (!canFormWord(word, sourceCounts)) return { status: GuessResult.NOT_IN_SOURCE, word };
  if (!isValidWord(word)) return { status: GuessResult.NOT_A_WORD, word };

  return { status: GuessResult.OK, word, score: scoreForWord(word) };
}
