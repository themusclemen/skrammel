// Enkla lokala UI-preferenser (t.ex. "visa inte den här texten igen"),
// separata från spelresultat/matchdata. Best-effort — localStorage kan vara
// otillgängligt (privat läge, fullt), då faller det bara tillbaka till
// standardbeteendet istället för att krascha.

export function getBoolPreference(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function setBoolPreference(key, value) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // best-effort, se ovan
  }
}
