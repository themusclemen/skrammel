import { BLIXT_AUTO_CPU_STORAGE_PREFIX, BLIXT_AUTO_CPU_INTERVAL_MS } from "./blixtConstants.js";

// En lokal (per enhet, aldrig i databasen — se blixtCpu.js för varför CPU
// aldrig rör Supabase) "CPU utmanar dig"-nudge i Blixt-Duells VÄNTANDE-
// lista, för spelare som annars inte har något att svara på. Källordet och
// CPU:ns poäng slumpas EN gång vid generering och sparas — samma princip
// som en riktig utmaning (skaparens poäng är redan känd), inte omslumpat
// varje gång listan ritas om.

function key(userId) {
  return BLIXT_AUTO_CPU_STORAGE_PREFIX + userId;
}

export function loadAutoCpuPrompt(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAutoCpuPrompt(userId, prompt) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prompt));
  } catch {
    // best-effort, se matchSeen.js
  }
}

// hasPendingRealChallenge: spelaren har redan en riktig utmaning (från en
// annan spelare) den inte godkänt än — se pendingBlixtInviteCount i App.jsx.
// Genererar aldrig ett nytt förslag ovanpå ett obesvarat (varken riktigt
// eller ett tidigare CPU-förslag), och högst en gång per
// BLIXT_AUTO_CPU_INTERVAL_MS oavsett.
export function shouldGenerateAutoCpuPrompt(userId, hasPendingRealChallenge) {
  if (hasPendingRealChallenge) return false;
  const stored = loadAutoCpuPrompt(userId);
  if (stored && stored.status === "pending") return false;
  const lastGeneratedAt = stored?.generatedAt ?? 0;
  return Date.now() - lastGeneratedAt >= BLIXT_AUTO_CPU_INTERVAL_MS;
}

export function generateAutoCpuPrompt(userId, sourceWord, cpuScore, cpuWords) {
  const prompt = { generatedAt: Date.now(), status: "pending", sourceWord, cpuScore, cpuWords };
  saveAutoCpuPrompt(userId, prompt);
  return prompt;
}

export function resolveAutoCpuPrompt(userId) {
  const stored = loadAutoCpuPrompt(userId);
  if (!stored) return;
  saveAutoCpuPrompt(userId, { ...stored, status: "resolved" });
}
