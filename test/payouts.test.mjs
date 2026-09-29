import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayout, addPayout } from "../src/payouts.mjs";

test("a payout is normalized from form text", () => {
  assert.deepEqual(parsePayout({ date: " 2026-09-29 ", eur: "150", note: " cash " }), { date: "2026-09-29", eur: 150, note: "cash" });
  assert.deepEqual(parsePayout({ date: "2026-09-29", eur: "12,50", note: "" }), { date: "2026-09-29", eur: 12.5 });
});

test("bad dates are rejected", () => {
  for (const date of ["", "29.09.2026", "2026-02-30", "2026-13-01"]) {
    assert.throws(() => parsePayout({ date, eur: "10" }), /real YYYY-MM-DD/, date);
  }
});

test("bad amounts are rejected", () => {
  for (const eur of ["", "0", "-5", "abc", "1.234"]) {
    assert.throws(() => parsePayout({ date: "2026-09-29", eur }), /positive number/, eur);
  }
});

test("payouts stay in date order, same-day entries keep entry order", () => {
  let list = [];
  list = addPayout(list, { date: "2026-09-10", eur: "50", note: "first" });
  list = addPayout(list, { date: "2026-08-01", eur: "20" });
  list = addPayout(list, { date: "2026-09-10", eur: "5", note: "second" });
  assert.deepEqual(list.map((p) => p.note ?? p.date), ["2026-08-01", "first", "second"]);
});
