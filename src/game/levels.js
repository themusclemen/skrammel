import { CHALLENGE_LEVELS } from "./constants.js";

// Räknar ut poängmål per nivå utifrån hur många poäng som totalt går att
// hitta i källordet. Avrundat nedåt till närmaste tiotal, men alltid
// strikt stigande — annars kan två nivåer hamna på samma mål för korta
// källord med lite total poäng.
export function computeLevelTargets(totalPossibleScore) {
  let previousTarget = 0;
  return CHALLENGE_LEVELS.map((level) => {
    const rounded = Math.floor((totalPossibleScore * level.percent) / 10) * 10;
    const target = Math.max(10, rounded, previousTarget + 10);
    previousTarget = target;
    return { ...level, target };
  });
}
