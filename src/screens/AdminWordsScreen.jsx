import { useState, useEffect, useMemo } from "react";
import { T } from "../theme.js";
import { getDictionary } from "../game/wordList.js";
import { buildCandidatePool, suggestSourceWord } from "../game/adminSuggest.js";
import { findWordsInSource } from "../game/findWords.js";
import { fetchAllDailyWords, upsertDailyWord, deleteDailyWord } from "../api/dailyWord.js";

const FORWARD_DAYS = 30; // hur långt fram utöver innevarande månad

function pad(n) { return String(n).padStart(2, "0"); }
// Lokala datumkomponenter, inte toISOString() — den konverterar till UTC och
// kan hoppa ett dygn bakåt i tidszoner öster om UTC (t.ex. CEST).
function localDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Från den 1:a i föregående månad till idag + FORWARD_DAYS — täcker alltid
// föregående och nuvarande månad (för arkivet/efterhandsifyllnad) plus en
// planeringsbuffert framåt.
function getDateRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today);
  end.setDate(end.getDate() + FORWARD_DAYS);

  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(localDateStr(d));
  }
  return dates;
}

export default function AdminWordsScreen() {
  const dictionary = useMemo(() => getDictionary(), []);
  const candidatePool = useMemo(() => buildCandidatePool(dictionary), [dictionary]);
  const dates = useMemo(() => getDateRange(), []);

  // rows[date] = { word, count, approved }
  const [rows, setRows] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savingDate, setSavingDate] = useState(null);
  const [error, setError] = useState(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    fetchAllDailyWords()
      .then((published) => {
        const byDate = Object.fromEntries(published.map((p) => [p.date, p.word]));
        const initial = {};
        for (const date of dates) {
          if (byDate[date]) {
            initial[date] = { word: byDate[date], count: findWordsInSource(byDate[date], dictionary).length, approved: true };
          }
        }
        setRows(initial);
        setLoaded(true);
      })
      .catch((e) => { setError(e.message); setLoaded(true); });
  }, [dates, dictionary]);

  useEffect(() => {
    if (loaded) generateMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  async function generateMissing() {
    setGenerating(true);
    setProgress(0);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      setRows((prev) => {
        if (prev[date]) return prev; // redan publicerat, rör inte
        const suggestion = suggestSourceWord(candidatePool, dictionary);
        return { ...prev, [date]: { word: suggestion.word, count: suggestion.count, approved: false } };
      });
      setProgress(i + 1);
      // Släpp tråden en tick så UI:t hinner rita om progress-baren.
      await new Promise((r) => setTimeout(r, 0));
    }
    setGenerating(false);
  }

  async function regenerateAllUnapproved() {
    setGenerating(true);
    setProgress(0);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      setRows((prev) => {
        if (prev[date]?.approved) return prev;
        const suggestion = suggestSourceWord(candidatePool, dictionary);
        return { ...prev, [date]: { word: suggestion.word, count: suggestion.count, approved: false } };
      });
      setProgress(i + 1);
      await new Promise((r) => setTimeout(r, 0));
    }
    setGenerating(false);
  }

  function handleRegenerateOne(date) {
    const suggestion = suggestSourceWord(candidatePool, dictionary);
    setRows((prev) => ({ ...prev, [date]: { word: suggestion.word, count: suggestion.count, approved: false } }));
  }

  function handleWordChange(date, value) {
    const word = value.toUpperCase();
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], word, approved: false } }));
  }

  function handleWordBlur(date) {
    const row = rows[date];
    if (!row?.word) return;
    const count = findWordsInSource(row.word, dictionary).length;
    setRows((prev) => ({ ...prev, [date]: { ...prev[date], count } }));
  }

  async function handleApprove(date, checked) {
    const row = rows[date];
    setSavingDate(date);
    setError(null);
    try {
      if (checked) {
        const word = row.word.trim().toUpperCase();
        if (!word) { setError(`${date}: fyll i ett ord`); setSavingDate(null); return; }
        await upsertDailyWord(date, word);
      } else {
        await deleteDailyWord(date);
      }
      setRows((prev) => ({ ...prev, [date]: { ...prev[date], approved: checked } }));
    } catch (e) {
      setError(e.message);
    }
    setSavingDate(null);
  }

  const approvedCount = Object.values(rows).filter((r) => r.approved).length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>SKRAMMEL ADMIN</div>
          <div style={styles.subtitle}>
            {loaded ? `${approvedCount} / ${dates.length} publicerade` : "Laddar från Supabase…"}
          </div>
        </div>

        {generating && (
          <div style={styles.progressWrap}>
            <div style={styles.progressLabel}>Genererar… {progress} / {dates.length}</div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${(progress / dates.length) * 100}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={() => setConfirmRegen(true)}
          disabled={generating}
          style={{ ...styles.regenAllButton, opacity: generating ? 0.5 : 1 }}
        >
          {generating ? "Genererar…" : "↻ Generera opublicerade"}
        </button>
      </div>

      {confirmRegen && (
        <div style={styles.backdrop} onClick={() => setConfirmRegen(false)}>
          <div style={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.5rem", color: T.text }}>Generera nya förslag för alla opublicerade dagar?</p>
            <p style={{ margin: "0 0 1rem", color: T.muted, fontSize: "0.85rem" }}>
              Publicerade dagar rörs inte.
            </p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => { setConfirmRegen(false); regenerateAllUnapproved(); }}
                style={styles.confirmYes}
              >
                Ja, generera
              </button>
              <button onClick={() => setConfirmRegen(false)} style={styles.confirmNo}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorBanner} onClick={() => setError(null)}>
          Fel: {error} ✕
        </div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Datum</th>
              <th style={styles.th}>Källord</th>
              <th style={styles.th}>Hittabara ord</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Publicera</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Gen.</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const row = rows[date];
              if (!row) return null;
              return (
                <tr key={date} style={{ background: row.approved ? "rgba(123, 216, 143, 0.12)" : "transparent" }}>
                  <td style={{ ...styles.td, color: T.muted, whiteSpace: "nowrap" }}>{date}</td>
                  <td style={styles.td}>
                    <input
                      value={row.word}
                      onChange={(e) => handleWordChange(date, e.target.value)}
                      onBlur={() => handleWordBlur(date)}
                      style={styles.input}
                      maxLength={12}
                    />
                  </td>
                  <td style={{ ...styles.td, color: T.muted }}>{row.count}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={row.approved}
                      disabled={savingDate === date}
                      onChange={(e) => handleApprove(date, e.target.checked)}
                      style={{ width: 16, height: 16, cursor: savingDate === date ? "wait" : "pointer" }}
                    />
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <button
                      onClick={() => handleRegenerateOne(date)}
                      disabled={generating}
                      style={styles.regenOneButton}
                      title="Generera nytt förslag"
                    >
                      ↻
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif" },
  header: {
    padding: "1.2rem 1.5rem", borderBottom: `1px solid ${T.border}`,
    display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap",
  },
  title: { fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.08em", color: T.accent },
  subtitle: { fontSize: "0.8rem", color: T.muted, marginTop: 2 },
  progressWrap: { flex: 1, maxWidth: 260 },
  progressLabel: { fontSize: "0.75rem", color: T.muted, marginBottom: 4 },
  progressTrack: { height: 6, background: T.tileEmpty, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", background: T.accent, borderRadius: 4, transition: "width 0.1s" },
  regenAllButton: {
    marginLeft: "auto", padding: "0.6rem 1rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
  },
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "1.5rem",
  },
  confirmCard: {
    width: "100%", maxWidth: 340, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "1.2rem",
  },
  confirmYes: {
    flex: 1, padding: "0.6rem", borderRadius: 8, border: "none",
    background: T.accent, color: "#121212", fontWeight: 700, cursor: "pointer",
  },
  confirmNo: {
    flex: 1, padding: "0.6rem", borderRadius: 8, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, cursor: "pointer",
  },
  errorBanner: {
    padding: "0.8rem 1.5rem", background: "rgba(255, 92, 77, 0.12)", color: T.accent2,
    fontSize: "0.85rem", borderBottom: `1px solid ${T.accent2}`, cursor: "pointer",
  },
  tableWrap: { overflowX: "auto", padding: "0 1.5rem" },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 560 },
  th: {
    padding: "0.7rem 0.6rem", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
    color: T.muted, textAlign: "left", borderBottom: `2px solid ${T.border}`,
    position: "sticky", top: 0, background: T.bg,
  },
  td: { padding: "0.4rem 0.6rem", borderBottom: `1px solid ${T.border}` },
  input: {
    width: "100%", boxSizing: "border-box", padding: "0.4rem 0.6rem", borderRadius: 6,
    border: `1px solid ${T.border}`, background: T.tile, color: T.tileText, fontWeight: 700,
    fontSize: "0.95rem", textTransform: "uppercase",
  },
  regenOneButton: {
    background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted,
    fontSize: "1.1rem", padding: "0.2rem 0.5rem", cursor: "pointer", lineHeight: 1,
  },
};
