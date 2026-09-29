import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePeriod, normalizeHistory } from "../src/fide.mjs";
import { assertNoLoss, buildReport } from "../src/report.mjs";

// Real FIDE response for 12859168, captured 2026-09-29 (Dec 2023 .. Sep 2026).
const raw = JSON.parse(readFileSync(new URL("fixtures/fide-12859168.json", import.meta.url), "utf8").replace(/^﻿/, ""));
const config = { player: { name: "Paulius Konovalovas", fideId: 12859168 }, categories: { standard: {}, rapid: {}, blitz: {} } };

test("FIDE periods become ISO months", () => {
  assert.equal(parsePeriod("2024-Jan"), "2024-01");
  assert.equal(parsePeriod("2026-Dec"), "2026-12");
  assert.throws(() => parsePeriod("2024-13"));
});

test("history is normalized to numbers and nulls in month order", () => {
  const history = normalizeHistory(raw);
  assert.equal(history.length, 34);
  assert.deepEqual(history[0], { month: "2023-12", standard: null, rapid: 1153, blitz: null });
  assert.deepEqual(history.at(-1), { month: "2026-09", standard: 2070, rapid: 2029, blitz: 1965 });
});

test("standard earnings match a hand calculation", () => {
  // 1557 first rating; records 1575 (+18), 1663 (+88), 1761 (+98),
  // 1843 (39 x €1 + 43 x €2 = 125), 1939 (96 x €2 = 192), 2070 (61 x €2 + 70 x €3 = 332).
  const report = buildReport(config, normalizeHistory(raw), "2026-09-29");
  assert.equal(report.categories.standard.total, 18 + 88 + 98 + 125 + 192 + 332);
  assert.equal(report.categories.standard.payouts.length, 6);
  assert.equal(report.total, Object.values(report.categories).reduce((s, c) => s + c.total, 0));
  assert.equal(report.months.length, 34);
});

test("a new report may not lower money already earned", () => {
  const report = buildReport(config, normalizeHistory(raw), "2026-09-29");
  assert.doesNotThrow(() => assertNoLoss(report, report));
  const revised = buildReport(config, normalizeHistory(raw.slice(0, -1)), "2026-09-29");
  assert.throws(() => assertNoLoss(report, revised), /Standard total would drop/);
});

test("an unknown rating type in the config is rejected", () => {
  assert.throws(() => buildReport({ ...config, categories: { Standard: {} } }, normalizeHistory(raw), "x"), /Unknown rating type/);
});

test("the agreed January 2025 baseline reproduces the sheet's €2,089", () => {
  const start = (record) => ({ start: { month: "2025-01", record } });
  const agreed = { ...config, categories: { standard: start(1479), rapid: start(1717), blitz: start(1542) } };
  const report = buildReport(agreed, normalizeHistory(raw), "2026-09-29");
  assert.deepEqual(Object.values(report.categories).map((c) => c.total), [931, 570, 588]);
  assert.equal(report.total, 2089);
});
