// Appends one payout to site/payouts.json. Used by the "Record payout" workflow form.
// Usage: PAYOUT_DATE=2026-09-29 PAYOUT_EUR=150 PAYOUT_NOTE="cash" node scripts/record-payout.mjs
import { readFile, writeFile } from "node:fs/promises";
import { addPayout } from "../src/payouts.mjs";

const file = new URL("../site/payouts.json", import.meta.url);
const list = JSON.parse(await readFile(file, "utf8"));
const date = process.env.PAYOUT_DATE?.trim() || new Date().toISOString().slice(0, 10);
const next = addPayout(list, { date, eur: process.env.PAYOUT_EUR, note: process.env.PAYOUT_NOTE });

await writeFile(file, JSON.stringify(next, null, 2) + "\n");
console.log(`Recorded €${process.env.PAYOUT_EUR.trim()} on ${date}; ${next.length} payouts in total`);
