import { T } from "../theme.js";

// En färg per ordlängd (2 upp till längsta hittabara ordet), regnbågsordning
// som i mockupen — cyklar om källordet ger fler längder än paletten.
const LENGTH_COLORS = [
  "#b39ddb", // violett
  "#7ec8f2", // blå
  "#5fd0c4", // teal
  "#7bd88f", // grön
  "#f2a65a", // orange
  "#f26d6d", // röd
  "#f2618a", // rosa
  "#c98be0", // lavendel
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Ett piller per ordlängd, format "längd:kvar". Fyllnadsgraden i pillret
// (vänster→höger) motsvarar hur stor andel av den längdens ord man redan
// hittat. Pillret man precis hittat ett ord i får dessutom en kort glöd +
// en liten pil under sig i ~1s (styrs av highlightLength/GameScreen).
export default function WordLengthHistogram({ totalByLength, foundByLength, highlightLength, onSelectLength }) {
  const maxLength = Math.max(2, ...Object.keys(totalByLength).map(Number));
  const lengths = [];
  for (let length = 2; length <= maxLength; length++) lengths.push(length);

  return (
    <div style={styles.row}>
      {lengths.map((length, i) => {
        const total = totalByLength[length] ?? 0;
        const foundCount = Math.min(foundByLength[length] ?? 0, total);
        const remaining = total - foundCount;
        const isEmpty = total === 0;
        const isHighlighted = length === highlightLength;
        const isComplete = !isEmpty && remaining === 0;
        const color = isEmpty ? T.muted : LENGTH_COLORS[i % LENGTH_COLORS.length];
        const fillPct = isEmpty ? 0 : Math.round((foundCount / total) * 100);
        const fillOpacity = isComplete ? 0.55 : 0.32;

        return (
          <div key={length} style={styles.column}>
            <button
              onClick={() => onSelectLength(length)}
              style={{
                ...styles.pill,
                borderColor: isEmpty ? T.border : color,
                color,
                boxShadow: isHighlighted ? `0 0 14px ${color}` : "none",
              }}
            >
              <div
                style={{
                  ...styles.fill,
                  width: `${fillPct}%`,
                  background: isEmpty ? "transparent" : hexToRgba(color, fillOpacity),
                }}
              />
              <span style={styles.pillText}>{length}:{remaining}</span>
            </button>
            <div style={{ ...styles.arrow, borderTopColor: isHighlighted ? color : "transparent" }} />
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  row: { display: "flex", flexWrap: "nowrap", gap: "0.4rem", width: "100%" },
  column: { display: "flex", flexDirection: "column", alignItems: "center", flex: "1 1 0", minWidth: 0 },
  pill: {
    position: "relative", width: "100%", textAlign: "center", padding: "0.45rem 0.2rem",
    borderRadius: 999, border: "2px solid", overflow: "hidden",
    transition: "box-shadow 0.2s ease", background: "transparent", cursor: "pointer",
    fontFamily: "inherit",
  },
  fill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    transition: "width 0.4s ease, background 0.2s ease",
  },
  pillText: {
    position: "relative", fontWeight: 700, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  arrow: {
    width: 0, height: 0, marginTop: 3,
    borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid transparent",
  },
};
