import { test } from "node:test";
import assert from "node:assert/strict";
import { ratePerPoint, earningsBetween, computeCategory } from "../src/earnings.mjs";

const series = (ratings, firstYear = 2024) =>
  ratings.map((rating, i) => ({
    month: `${firstYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    rating,
  }));

test("tier boundaries are inclusive at the top", () => {
  assert.equal(ratePerPoint(1800), 1);
  assert.equal(ratePerPoint(1801), 2);
  assert.equal(ratePerPoint(2000), 2);
  assert.equal(ratePerPoint(2001), 3);
  assert.equal(ratePerPoint(2200), 3);
  assert.equal(ratePerPoint(2201), 4);
  assert.equal(ratePerPoint(2400), 4);
  assert.equal(ratePerPoint(2401), 5);
  assert.equal(ratePerPoint(2900), 5);
});

test("a climb across a tier boundary pays each point at its own rate", () => {
  assert.equal(earningsBetween(1798, 1802), 1 + 1 + 2 + 2);
  assert.equal(earningsBetween(1990, 2010), 10 * 2 + 10 * 3);
  assert.equal(earningsBetween(1700, 1700), 0);
});

test("the first rating sets the record and pays nothing", () => {
  const { months, total } = computeCategory(series([1500]));
  assert.deepEqual(months[0], { month: "2024-01", rating: 1500, record: 1500, earned: 0, total: 0 });
  assert.equal(total, 0);
});

test("after a drop nothing pays until the old record is beaten", () => {
  const { months, payouts, total } = computeCategory(series([1500, 1600, 1550, 1580, 1650]));
  assert.deepEqual(months.map((m) => m.earned), [0, 100, 0, 0, 50]);
  assert.deepEqual(months.map((m) => m.record), [1500, 1600, 1600, 1600, 1650]);
  assert.deepEqual(payouts, [
    { month: "2024-02", from: 1500, to: 1600, points: 100, eur: 100 },
    { month: "2024-05", from: 1600, to: 1650, points: 50, eur: 50 },
  ]);
  assert.equal(total, 150);
});

test("unrated months carry the record and pay nothing", () => {
  const { months } = computeCategory(series([null, 1500, null, 1520]));
  assert.deepEqual(months.map((m) => m.record), [null, 1500, 1500, 1520]);
  assert.deepEqual(months.map((m) => m.earned), [0, 0, 0, 20]);
});

test("a start point freezes earlier months and sets the record", () => {
  const { months, payouts } = computeCategory(series([1650, 1720, 1690, 1750]), { month: "2024-02", record: 1700 });
  assert.deepEqual(months.map((m) => m.record), [1700, 1700, 1700, 1750]);
  assert.deepEqual(payouts, [{ month: "2024-04", from: 1700, to: 1750, points: 50, eur: 50 }]);
});

test("a start point before the history still sets the record", () => {
  const { payouts } = computeCategory(series([1650, 1720]), { month: "2023-06", record: 1700 });
  assert.deepEqual(payouts, [{ month: "2024-02", from: 1700, to: 1720, points: 20, eur: 20 }]);
});
