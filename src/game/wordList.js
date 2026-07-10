let dictionary = null; // Set<string> | null medan den laddas
let loadPromise = null;

// Laddar public/ordlista.txt en gång och bygger ett Set (versaler, för att
// matcha resten av spelets bokstavshantering). Måste anropas (och väntas in)
// innan isValidWord ger tillförlitliga svar — se loadWordList i App.jsx.
export function loadWordList() {
  if (!loadPromise) {
    loadPromise = fetch("/ordlista.txt")
      .then((res) => res.text())
      .then((text) => {
        dictionary = new Set(
          text
            .split("\n")
            .map((line) => line.trim().toUpperCase())
            .filter((word) => word.length > 0)
        );
      });
  }
  return loadPromise;
}

export function isWordListReady() {
  return dictionary !== null;
}

export function isValidWord(word) {
  if (!dictionary) return false;
  return dictionary.has(word.toUpperCase());
}

export function getDictionary() {
  return dictionary ?? new Set();
}
