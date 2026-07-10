export function letterCounts(word) {
  const counts = {};
  for (const letter of word.toUpperCase()) {
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  return counts;
}

// Bokstäverna i candidate måste finnas i sourceCounts, och inte fler gånger
// än de förekommer i källordet (fri ordning, ingen sammanhängande substräng).
export function canFormWord(candidate, sourceCounts) {
  const needed = letterCounts(candidate);
  return Object.entries(needed).every(
    ([letter, count]) => (sourceCounts[letter] ?? 0) >= count
  );
}
