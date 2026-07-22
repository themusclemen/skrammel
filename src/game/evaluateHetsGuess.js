import { letterCounts, canFormWord } from "./letters.js";
import { isValidWord } from "./wordList.js";

export const HetsGuessResult = {
  OK: "ok",
  WRONG_LENGTH: "wrong_length",
  NOT_IN_LETTERS: "not_in_letters",
  NOT_A_WORD: "not_a_word",
};

// Till skillnad från evaluateGuess.js (som accepterar VILKET delord som
// helst av källordets bokstäver) måste gissningen här använda ALLA
// bokstäverna — canFormWord garanterar redan "bara bokstäver som finns i
// poolen", så en längdkontroll räcker för att veta att inget blir över
// (samma knep som isPangram i scoring.js).
export function evaluateHetsGuess(rawWord, letters) {
  const word = rawWord.trim().toUpperCase();
  const sourceCounts = letterCounts(letters.join(""));

  if (word.length !== letters.length) return { status: HetsGuessResult.WRONG_LENGTH, word };
  if (!canFormWord(word, sourceCounts)) return { status: HetsGuessResult.NOT_IN_LETTERS, word };
  if (!isValidWord(word)) return { status: HetsGuessResult.NOT_A_WORD, word };

  return { status: HetsGuessResult.OK, word };
}
