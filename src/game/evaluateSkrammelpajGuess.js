import { canFormWord } from "./letters.js";
import { isValidWord } from "./wordList.js";

export const SkrammelpajGuessResult = {
  OK: "ok",
  NOT_IN_POOL: "not_in_pool",
  NOT_A_WORD: "not_a_word",
};

// Till skillnad från evaluateGuess (Blixt/dagens ord) spelas ett drag mot en
// pool som krymper permanent mellan drag, inte ett fast källord — och det
// finns ingen minsta ordlängd (bekräftat speldesignbeslut) eller "redan
// hittat"-spärr (samma ord kan i praktiken ändå inte återanvändas när
// bokstäverna väl är förbrukade).
export function evaluateSkrammelpajMove(rawWord, remainingCounts) {
  const word = rawWord.trim().toUpperCase();

  if (!canFormWord(word, remainingCounts)) return { status: SkrammelpajGuessResult.NOT_IN_POOL, word };
  if (!isValidWord(word)) return { status: SkrammelpajGuessResult.NOT_A_WORD, word };

  return { status: SkrammelpajGuessResult.OK, word };
}
