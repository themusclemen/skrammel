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

// Högsta nivå spelaren någonsin nått, oavsett vilken dag — utifrån
// level_times-nycklarna som redan sparas med varje resultat (se
// GameScreen.jsx). Tar en lista av level_times-objekt, ett per spelat
// resultat, och returnerar namnet på den högsta nivån som förekommer i
// någon av dem, eller null om ingen nivå någonsin nåtts.
// Vilken nivå ett givet resultat räcker till, utifrån samma måltrappa som
// ChallengeBar visar under spelet — används för spoilerfri delning på
// ResultScreen (visar dagens nådda nivå, inte vilka ord som hittades).
export function levelReachedForScore(score, totalPossibleScore) {
  const targets = computeLevelTargets(totalPossibleScore);
  let reached = null;
  for (const level of targets) {
    if (score >= level.target) reached = level.name;
  }
  return reached;
}

export function bestLevelReached(levelTimesList) {
  let bestIndex = -1;
  for (const levelTimes of levelTimesList) {
    for (let i = CHALLENGE_LEVELS.length - 1; i > bestIndex; i--) {
      if (CHALLENGE_LEVELS[i].name in levelTimes) {
        bestIndex = i;
        break;
      }
    }
  }
  return bestIndex === -1 ? null : CHALLENGE_LEVELS[bestIndex].name;
}
