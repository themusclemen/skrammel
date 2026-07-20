// Lokalt sparade "senast sedda" statusar per match — det finns ingen
// server-side läst-markering, så "ny uppdatering" betyder bara "status har
// ändrats sen den här enheten senast öppnade Blixt-huben".
const STORAGE_KEY_PREFIX = "skrammel_blixt_seen_";

export function loadSeenStatuses(userId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSeenStatuses(userId, challenges) {
  const map = {};
  for (const c of challenges) map[c.id] = c.status;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(map));
  } catch {
    // localStorage kan vara otillgängligt (privat läge, fullt) — notisen är
    // best-effort, inget att göra åt om skrivningen misslyckas.
  }
}
