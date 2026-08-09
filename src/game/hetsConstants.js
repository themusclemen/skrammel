export const HETS_MIN_LETTERS = 3;
export const HETS_ROUND_DURATION_SECONDS = 30;

// Hur långt uppåt i ordlängd vi letar om ordlistan saknar exakt önskad
// längd (extremt ovanligt givet 70k+ ord, men skyddar mot en tom pool).
export const HETS_MAX_LENGTH_LOOKAHEAD = 5;

// localStorage-nyckel för "Visa inte denna text igen" på förklaringsskärmen.
export const HETS_SKIP_INFO_KEY = "skrammel_hets_skip_info";
