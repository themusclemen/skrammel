// Lokalt sparade "dolda av mig"-matcher — en spelare kan dölja en avslutad
// match ur sin egen lista utan att röra själva databasraden (den behöver
// leva kvar så topplistans vinst/förlust-räkning förblir korrekt, se
// BLIXT_COMPLETED_VISIBLE_MS i blixtConstants.js). Samma
// storageKeyPrefix+userId-mönster som matchSeen.js.

export function loadDismissedIds(storageKeyPrefix, userId) {
  try {
    const raw = localStorage.getItem(storageKeyPrefix + userId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function dismissMatch(storageKeyPrefix, userId, challengeId) {
  const ids = loadDismissedIds(storageKeyPrefix, userId);
  ids.add(challengeId);
  try {
    localStorage.setItem(storageKeyPrefix + userId, JSON.stringify([...ids]));
  } catch {
    // best-effort, se matchSeen.js
  }
}
