function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Räknar sammanhängande dagar spelaren har spelat, bakåt från idag. Om
// dagens datum inte finns med än (spelaren har inte spelat idag än) räknas
// strecket ändå från igår — annars skulle det falla till 0 varje ny dag
// innan spelaren hunnit spela, trots att strecket egentligen lever kvar.
export function computeStreak(playedDates, todayStr) {
  const played = new Set(playedDates);
  const cursor = new Date(`${todayStr}T00:00:00`);
  if (!played.has(todayStr)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (played.has(formatDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
