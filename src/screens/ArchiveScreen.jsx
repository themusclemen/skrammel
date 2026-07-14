import { useState, useMemo } from "react";
import { T } from "../theme.js";
import ReplayConfirmModal from "../components/ReplayConfirmModal.jsx";

const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];
const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

// Månadsraster: null för tomma rutor före/efter månadens dagar. Måndag först.
function getMonthGrid(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dateStr(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function ArchiveScreen({ playableDates, playedDates, onSelectDate, onBack }) {
  const today = useMemo(() => new Date(), []);
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const weeks = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const playableSet = useMemo(() => new Set(playableDates), [playableDates]);
  const playedSet = useMemo(() => new Set(playedDates), [playedDates]);
  const [replayDate, setReplayDate] = useState(null);

  const handleSelectDate = (date) => {
    if (playedSet.has(date)) setReplayDate(date);
    else onSelectDate(date);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div style={styles.page}>
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} style={styles.backLink}>← Till start</a>
      <h1 style={styles.title}>Tidigare utmaningar</h1>

      <div style={styles.monthNav}>
        <button onClick={goPrevMonth} style={styles.navButton}>‹</button>
        <span style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={goNextMonth} style={styles.navButton}>›</button>
      </div>

      <div style={styles.weekdayRow}>
        {WEEKDAYS.map((w, i) => <div key={i} style={styles.weekday}>{w}</div>)}
      </div>

      <div style={styles.calendar}>
        {weeks.map((week, wi) => (
          <div key={wi} style={styles.weekRow}>
            {week.map((date, di) => {
              if (!date) return <div key={di} style={styles.dayCell} />;

              const isPlayable = playableSet.has(date) && date <= todayStr;
              const isPlayed = playedSet.has(date);
              const isToday = date === todayStr;
              const dayNum = Number(date.slice(-2));

              return (
                <button
                  key={di}
                  onClick={() => isPlayable && handleSelectDate(date)}
                  disabled={!isPlayable}
                  style={{
                    ...styles.dayCell,
                    ...styles.dayButton,
                    ...(isPlayable ? styles.dayPlayable : styles.dayUnplayable),
                    ...(isPlayed ? styles.dayPlayed : null),
                    ...(isToday ? styles.dayToday : null),
                  }}
                >
                  {dayNum}
                  {isPlayed && <span style={styles.checkmark}>✓</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={styles.legend}>
        <span><span style={{ ...styles.legendDot, background: T.accent }} /> Spelbar</span>
        <span><span style={{ ...styles.legendDot, background: "#7bd88f" }} /> Klarad</span>
      </div>

      {replayDate && (
        <ReplayConfirmModal
          onConfirm={() => { const date = replayDate; setReplayDate(null); onSelectDate(date, { isReplay: true }); }}
          onCancel={() => setReplayDate(null)}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem", gap: "0.8rem",
  },
  backLink: { alignSelf: "flex-start", color: T.muted, fontSize: "0.9rem" },
  title: { fontSize: "1.4rem", margin: "0.2rem 0 0.6rem", color: T.accent },
  monthNav: { display: "flex", alignItems: "center", gap: "1rem" },
  navButton: {
    background: T.surface, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8,
    width: "2.2rem", height: "2.2rem", fontSize: "1.2rem", cursor: "pointer",
  },
  monthLabel: { fontWeight: 700, minWidth: 140, textAlign: "center" },
  weekdayRow: { display: "flex", gap: "0.4rem", width: "100%", maxWidth: 320, marginTop: "0.5rem" },
  weekday: { flex: 1, textAlign: "center", color: T.muted, fontSize: "0.75rem" },
  calendar: { display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%", maxWidth: 320 },
  weekRow: { display: "flex", gap: "0.4rem" },
  dayCell: {
    flex: 1, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, fontSize: "0.9rem", position: "relative",
  },
  dayButton: { border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: "pointer", fontFamily: "inherit" },
  dayPlayable: { borderColor: T.accent, color: T.accent, fontWeight: 700 },
  dayUnplayable: { color: T.muted, borderStyle: "dashed", cursor: "default", opacity: 0.5 },
  dayPlayed: { background: "rgba(123, 216, 143, 0.15)", borderColor: "#7bd88f", color: "#7bd88f" },
  dayToday: { boxShadow: `0 0 0 2px ${T.accent}` },
  checkmark: { position: "absolute", bottom: 2, right: 4, fontSize: "0.6rem" },
  legend: { display: "flex", gap: "1.2rem", marginTop: "1rem", fontSize: "0.8rem", color: T.muted },
  legendDot: { display: "inline-block", width: 8, height: 8, borderRadius: 999, marginRight: "0.4rem" },
};
