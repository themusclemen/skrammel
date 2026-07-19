import { useState } from "react";

// Delar text via native share-sheet där det finns, annars kopierar till
// urklipp. Används av både resultat-delning och vän-inbjudan/utmaning.
export function useShare() {
  const [copied, setCopied] = useState(false);

  const share = async (text) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // Avbruten delning (t.ex. användaren stängde dialogen) — inget att göra.
      }
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return { share, copied };
}
