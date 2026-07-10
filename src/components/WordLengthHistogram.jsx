import { T } from "../theme.js";

const MAX_BAR_HEIGHT = 130; // px

// En stapel per ordlängd (2 upp till längsta hittabara ordet för dagens
// källord). Stapelns höjd = hur många ord av den längden som *går att hitta*
// totalt, den ifyllda delen = hur många spelaren redan *har* hittat.
export default function WordLengthHistogram({ totalByLength, foundByLength, highlightLength }) {
  const maxLength = Math.max(2, ...Object.keys(totalByLength).map(Number));
  const lengths = [];
  for (let length = 2; length <= maxLength; length++) lengths.push(length);

  const maxCount = Math.max(1, ...Object.values(totalByLength));

  return (
    <div style={styles.row}>
      {lengths.map((length) => {
        const total = totalByLength[length] ?? 0;
        const foundCount = Math.min(foundByLength[length] ?? 0, total);
        // Ingen tvingad minsta höjd — finns inga ord av en längd ska stapeln vara helt tom.
        const barHeight = total > 0 ? Math.max(Math.round((total / maxCount) * MAX_BAR_HEIGHT), 4) : 0;
        const fillHeight = total > 0 ? Math.round((foundCount / total) * barHeight) : 0;
        const isHighlighted = length === highlightLength;

        return (
          <div key={length} style={styles.column}>
            <div style={{ ...styles.count, ...(isHighlighted ? styles.countHighlight : null) }}>
              {foundCount}/{total}
            </div>
            <div style={{ ...styles.track, height: barHeight, ...(isHighlighted ? styles.trackHighlight : null) }}>
              <div style={{ ...styles.fill, height: fillHeight }} />
            </div>
            <div style={{ ...styles.label, ...(isHighlighted ? styles.labelHighlight : null) }}>{length}</div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  row: { display: "flex", flexWrap: "nowrap", alignItems: "flex-end", gap: "0.5rem", width: "100%" },
  column: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", flex: "1 1 0", minWidth: 0 },
  count: {
    fontSize: "0.8rem", color: T.muted, fontVariantNumeric: "tabular-nums",
    transition: "color 0.2s ease",
  },
  countHighlight: { color: T.accent, fontWeight: 700 },
  track: {
    width: "100%", borderRadius: 8, background: T.tileEmpty,
    display: "flex", alignItems: "flex-end", overflow: "hidden",
    transition: "background 0.2s ease, box-shadow 0.2s ease",
  },
  trackHighlight: { background: T.accent, boxShadow: `0 0 14px ${T.accent}` },
  fill: { width: "100%", background: T.accent, transition: "height 0.3s ease" },
  label: { fontSize: "1.05rem", color: T.text, fontWeight: 700, transition: "color 0.2s ease" },
  labelHighlight: { color: T.accent },
};
