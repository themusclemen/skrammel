#!/usr/bin/env node
// Kureringsverktyg: visa alla ord som går att bilda ur ett kandidat-källord,
// innan det publiceras som dagens ord. Användning:
//   node scripts/findWordsIn.mjs LÄSKEDRYCK

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findWordsInSource } from "../src/game/findWords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceWord = process.argv[2];

if (!sourceWord) {
  console.error("Användning: node scripts/findWordsIn.mjs LÄSKEDRYCK");
  process.exit(1);
}

const wordListPath = path.join(__dirname, "..", "public", "ordlista.txt");
const dictionary = readFileSync(wordListPath, "utf-8")
  .split("\n")
  .map((line) => line.trim().toUpperCase())
  .filter((word) => word.length > 0);

const found = findWordsInSource(sourceWord, dictionary);

const byLength = new Map();
for (const word of found) {
  if (!byLength.has(word.length)) byLength.set(word.length, []);
  byLength.get(word.length).push(word);
}

console.log(`${sourceWord.toUpperCase()} — ${found.length} ord hittade\n`);
for (const length of [...byLength.keys()].sort((a, b) => b - a)) {
  console.log(`${length} bokstäver (${byLength.get(length).length}): ${byLength.get(length).join(", ")}`);
}
