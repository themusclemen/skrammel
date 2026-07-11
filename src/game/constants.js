export const MIN_WORD_LENGTH = 2;
export const GAME_DURATION_SECONDS = 5 * 60;

// Nivåtrappa: hur stor andel av den totalt möjliga poängen (alla hittabara
// ord i källordet) varje nivå kräver. Testvärden, justera vid behov.
export const CHALLENGE_LEVELS = [
  { name: "Dagens utmaning", percent: 0.05 },
  { name: "PROFFS", percent: 0.1 },
  { name: "ELIT", percent: 0.15 },
  { name: "GENI", percent: 0.2 },
  { name: "GUD", percent: 0.3 },
];

// Används lokalt tills daily_words-tabellen har data för dagens datum.
export const FALLBACK_WORD = "BASRELIEF";
