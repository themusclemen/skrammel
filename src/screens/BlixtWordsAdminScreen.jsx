import { useState, useEffect, useMemo } from "react";
import { T } from "../theme.js";
import { getDictionary } from "../game/wordList.js";
import { buildCandidatePool, suggestSourceWord } from "../game/adminSuggest.js";
import { BLIXT_WORD_LENGTH, BLIXT_MIN_FINDABLE, BLIXT_MAX_FINDABLE } from "../game/blixtConstants.js";
import {
  fetchAllBlixtWords,
  insertBlixtWordCandidates,
  setBlixtWordApproved,
  deleteBlixtWord,
} from "../api/blixtWords.js";

const GENERATE_COUNT = 500;
const MAX_FRESH_ATTEMPTS = 5; // försök hitta ett ord som inte redan finns, innan slotten hoppas över

// suggestSourceWord ger annars tillbaka en dubblett eller ett förslag
// utanför räckvidden om poolen är svår att träffa — här kräver vi bådadera:
// unikt (mot redan lagrade + redan genererade i den här omgången) och
// faktiskt inom [minFindable, maxFindable], annars hoppas platsen över.
function generateFreshCandidate(candidatePool, dictionary, usedWords) {
  for (let i = 0; i < MAX_FRESH_ATTEMPTS; i++) {
    const suggestion = suggestSourceWord(candidatePool, dictionary, {
      minFindable: BLIXT_MIN_FINDABLE,
      maxFindable: BLIXT_MAX_FINDABLE,
    });
    if (
      suggestion &&
      !usedWords.has(suggestion.word) &&
      suggestion.count >= BLIXT_MIN_FINDABLE &&
      suggestion.count <= BLIXT_MAX_FINDABLE
    ) {
      return suggestion;
    }
  }
  return null;
}

export default function BlixtWordsAdminScreen() {
  const dictionary = useMemo(() => getDictionary(), []);
  const candidatePool = useMemo(
    () => buildCandidatePool(dictionary, { minLength: BLIXT_WORD_LENGTH, maxLength: BLIXT_WORD_LENGTH }),
    [dictionary]
  );

  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [filter, setFilter] = useState("pending"); // "pending" | "approved" | "all"

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const all = await fetchAllBlixtWords();
      setRows(all);
    } catch (e) {
      setError(e.message);
    }
    setLoaded(true);
  }

  async function handleGenerate() {
    setGenerating(true);
    setProgress(0);
    setError(null);

    const usedWords = new Set(rows.map((r) => r.word));
    const newCandidates = [];
    for (let i = 0; i < GENERATE_COUNT; i++) {
      const candidate = generateFreshCandidate(candidatePool, dictionary, usedWords);
      if (candidate) {
        usedWords.add(candidate.word);
        newCandidates.push(candidate);
      }
      setProgress(i + 1);
      // Släpp tråden en tick så UI:t hinner rita om progress-baren.
      await new Promise((r) => setTimeout(r, 0));
    }

    try {
      await insertBlixtWordCandidates(newCandidates);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  }

  async function handleApprove(id, approved) {
    setSavingId(id);
    setError(null);
    try {
      await setBlixtWordApproved(id, approved);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
    } catch (e) {
      setError(e.message);
    }
    setSavingId(null);
  }

  async function handleDelete(id) {
    setSavingId(id);
    setError(null);
    try {
      await deleteBlixtWord(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
    setSavingId(null);
  }

  const approvedCount = rows.filter((r) => r.approved).length;
  const pendingCount = rows.length - approvedCount;
  const visibleRows = rows.filter((r) => {
    if (filter === "approved") return r.approved;
    if (filter === "pending") return !r.approved;
    return true;
  });

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>BLIXT ADMIN</div>
          <div style={styles.subtitle}>
            {loaded ? `${approvedCount} godkända · ${pendingCount} väntar granskning` : "Laddar från Supabase…"}
          </div>
        </div>

        {generating && (
          <div style={styles.progressWrap}>
            <div style={styles.progressLabel}>Genererar… {progress} / {GENERATE_COUNT}</div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${(progress / GENERATE_COUNT) * 100}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={() => setConfirmGenerate(true)}
          disabled={generating}
          style={{ ...styles.regenAllButton, opacity: generating ? 0.5 : 1 }}
        >
          {generating ? "Genererar…" : `↻ Generera ${GENERATE_COUNT} kandidater`}
        </button>
      </div>

      {confirmGenerate && (
        <div style={styles.backdrop} onClick={() => setConfirmGenerate(false)}>
          <div style={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 0.5rem", color: T.text }}>
              Generera {GENERATE_COUNT} nya kandidatord?
            </p>
            <p style={{ margin: "0 0 1rem", color: T.muted, fontSize: "0.85rem" }}>
              Redan lagrade ord rörs inte. Kan ta upp till någon minut.
            </p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => { setConfirmGenerate(false); handleGenerate(); }}
                style={styles.confirmYes}
              >
                Ja, generera
              </button>
              <button onClick={() => setConfirmGenerate(false)} style={styles.confirmNo}>
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

      <div style={styles.filterRow}>
        {[
          ["pending", `Väntar (${pendingCount})`],
          ["approved", `Godkända (${approvedCount})`],
          ["all", `Alla (${rows.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{ ...styles.filterButton, ...(filter === key ? styles.filterButtonActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ord</th>
              <th style={styles.th}>Hittabara ord</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Godkänd</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Kasta</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} style={{ background: row.approved ? "rgba(123, 216, 143, 0.12)" : "transparent" }}>
                <td style={{ ...styles.td, fontWeight: 700 }}>{row.word}</td>
                <td style={{ ...styles.td, color: T.muted }}>{row.findable_count}</td>
                <td style={{ ...styles.td, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={row.approved}
                    disabled={savingId === row.id}
                    onChange={(e) => handleApprove(row.id, e.target.checked)}
                    style={{ width: 16, height: 16, cursor: savingId === row.id ? "wait" : "pointer" }}
                  />
                </td>
                <td style={{ ...styles.td, textAlign: "center" }}>
                  <button
                    onClick={() => handleDelete(row.id)}
                    disabled={savingId === row.id}
                    style={styles.deleteButton}
                    title="Ta bort permanent"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {loaded && visibleRows.length === 0 && (
              <tr>
                <td style={{ ...styles.td, color: T.muted }} colSpan={4}>
                  Inga ord i den här vyn än.
                </td>
              </tr>
            )}
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
  filterRow: { display: "flex", gap: "0.5rem", padding: "1rem 1.5rem 0" },
  filterButton: {
    padding: "0.4rem 0.9rem", borderRadius: 999, border: `1px solid ${T.border}`,
    background: "transparent", color: T.muted, fontSize: "0.8rem", cursor: "pointer",
  },
  filterButtonActive: { background: T.accent, color: "#121212", fontWeight: 700, borderColor: T.accent },
  tableWrap: { overflowX: "auto", padding: "1rem 1.5rem" },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 420 },
  th: {
    padding: "0.7rem 0.6rem", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
    color: T.muted, textAlign: "left", borderBottom: `2px solid ${T.border}`,
    position: "sticky", top: 0, background: T.bg,
  },
  td: { padding: "0.4rem 0.6rem", borderBottom: `1px solid ${T.border}` },
  deleteButton: {
    background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.accent2,
    fontSize: "0.9rem", padding: "0.2rem 0.5rem", cursor: "pointer", lineHeight: 1,
  },
};
