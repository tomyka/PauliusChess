# Paulius Rating Bounty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public web page that shows Paulius Konovalovas's FIDE Standard, Rapid and Blitz ratings over time and the euros earned under the record-high bounty. It refreshes itself on the 2nd of every month.

**Architecture:** A dependency-free Node script fetches the full rating history from FIDE's JSON endpoint and runs it through a pure earnings module. It writes one `site/data.json`. A single static `site/index.html` draws four visuals from that file in inline SVG. A GitHub Actions workflow runs the script monthly, commits the data, and deploys `site/` to GitHub Pages.

**Tech Stack:** Node 24 (ES modules, `node:test`, global `fetch`), plain HTML/CSS/SVG, GitHub Actions, GitHub Pages.

---

## Decisions

| Topic | Decision |
|---|---|
| Player | Paulius Konovalovas, FIDE ID 12859168 (LTU, born 2015) |
| Data source | `https://ratings.fide.com/a_chart_data.phtml?event=12859168&period=0` returns the monthly history for all three types, oldest first, with a UTF-8 BOM. Send `X-Requested-With: XMLHttpRequest`. |
| Pay rule | Each point above the record pays its tier rate: €1 up to 1800, €2 for 1801-2000, €3 for 2001-2200, €4 for 2201-2400, €5 above 2400. Tiers are inclusive at the top. |
| Record | Separate for each type, never goes down. A drop pays nothing until the old record is beaten. |
| Baseline | The first published rating in each type sets the record and pays nothing. Past earnings are recalculated with the tiers. An optional `start: { month, record }` per type in `config.json` overrides this, for example to honour amounts already paid at the old flat €3 rate. |
| Unrated months | A `null` rating carries the record forward and pays nothing. The chart line breaks there. |
| Hosting | GitHub Pages from a public repo, with no login needed to view. |
| Schedule | A Windows scheduled task on the owner's PC runs on the 2nd at 09:00, and catches up after a missed start. It runs `scripts/monthly.ps1`, which fetches, commits and pushes. The GitHub workflow only tests and deploys on push. The first plan was a GitHub `cron`, but a probe on 2026-09-29 showed ratings.fide.com times out from GitHub runners, while www.fide.com answers. |

## File structure

| File | Responsibility |
|---|---|
| `src/earnings.mjs` | Pay tiers, per-point rate, and the record/earnings walk over one rating series. Pure. |
| `src/fide.mjs` | FIDE period parsing, row normalization, HTTP fetch. |
| `src/report.mjs` | Combines the config and history into the `data.json` shape. Pure. |
| `scripts/update.mjs` | IO wrapper: reads config, fetches, writes `site/data.json`. |
| `config.json` | Player identity and per-type options (`start`). |
| `site/index.html` | Dashboard, with styles from `docs/design/mockup.html` and a script that reads `data.json`. |
| `site/data.json` | Generated. Committed so Pages and git history show every monthly change. |
| `test/earnings.test.mjs` | The pay rule. |
| `test/report.test.mjs` | FIDE parsing and a hand-checked total against a real captured response. |
| `test/fixtures/fide-12859168.json` | FIDE response captured 2026-09-29. |
| `.github/workflows/update.yml` | Test and Pages deploy on push. |
| `scripts/monthly.ps1` | Monthly job for Windows Task Scheduler: pull, update, commit, push. |

### `data.json` shape

```json
{
  "player": { "name": "Paulius Konovalovas", "fideId": 12859168 },
  "updatedAt": "2026-09-29",
  "tiers": [{ "from": 0, "to": 1800, "eur": 1 }, "...", { "from": 2400, "to": null, "eur": 5 }],
  "months": ["2023-12", "...", "2026-09"],
  "categories": {
    "standard": {
      "name": "Standard",
      "months": [{ "month": "2023-12", "rating": null, "record": null, "earned": 0, "total": 0 }],
      "payouts": [{ "month": "2025-02", "from": 1557, "to": 1575, "points": 18, "eur": 18 }],
      "total": 853
    }
  },
  "total": 2560
}
```

---

### Task 1: Project skeleton

**Files:**
- Create: `package.json`, `config.json`, `.gitignore`

- [x] **Step 1: Write `package.json`**

```json
{
  "name": "paulius-chess",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test",
    "update": "node scripts/update.mjs",
    "preview": "npx --yes serve site"
  }
}
```

- [x] **Step 2: Write `config.json`**

```json
{
  "player": { "name": "Paulius Konovalovas", "fideId": 12859168 },
  "categories": { "standard": {}, "rapid": {}, "blitz": {} }
}
```

- [x] **Step 3: Commit** with `git add package.json config.json .gitignore && git commit -m "chore: project skeleton"`

### Task 2: Earnings rule (TDD)

**Files:**
- Create: `src/earnings.mjs`
- Test: `test/earnings.test.mjs`

- [x] **Step 1: Write the failing tests**

```js
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
```

- [x] **Step 2: Run `npm test`.** Expected: FAIL, because `src/earnings.mjs` cannot be found.

- [x] **Step 3: Implement `src/earnings.mjs`**

```js
export const TIERS = [
  { from: 0, to: 1800, eur: 1 },
  { from: 1800, to: 2000, eur: 2 },
  { from: 2000, to: 2200, eur: 3 },
  { from: 2200, to: 2400, eur: 4 },
  { from: 2400, to: null, eur: 5 },
];

export function ratePerPoint(point) {
  return TIERS.find((t) => t.to === null || point <= t.to).eur;
}

export function earningsBetween(from, to) {
  let sum = 0;
  for (let point = from + 1; point <= to; point++) sum += ratePerPoint(point);
  return sum;
}

export function computeCategory(series, start) {
  let record = null;
  let total = 0;
  const months = [];
  const payouts = [];
  for (const { month, rating } of series) {
    let earned = 0;
    if (start && month <= start.month) {
      record = start.record;
    } else if (rating !== null) {
      if (record === null) {
        record = rating;
      } else if (rating > record) {
        earned = earningsBetween(record, rating);
        payouts.push({ month, from: record, to: rating, points: rating - record, eur: earned });
        record = rating;
      }
    }
    total += earned;
    months.push({ month, rating, record, earned, total });
  }
  return { months, payouts, total };
}
```

- [x] **Step 4: Run `npm test`.** Expected: 6 passing.
- [x] **Step 5: Commit** with `git commit -m "feat: tiered record-high earnings rule"`

### Task 3: FIDE client and report (TDD)

**Files:**
- Create: `src/fide.mjs`, `src/report.mjs`, `test/fixtures/fide-12859168.json`
- Test: `test/report.test.mjs`

- [x] **Step 1: Capture the fixture**

Run: `curl -s -A "Mozilla/5.0" -H "X-Requested-With: XMLHttpRequest" "https://ratings.fide.com/a_chart_data.phtml?event=12859168&period=0" -o test/fixtures/fide-12859168.json`

- [x] **Step 2: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePeriod, normalizeHistory } from "../src/fide.mjs";
import { buildReport } from "../src/report.mjs";

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
```

- [x] **Step 3: Run `npm test`.** Expected: FAIL, because the modules are missing.

- [x] **Step 4: Implement `src/fide.mjs`**

```js
const HISTORY_URL = "https://ratings.fide.com/a_chart_data.phtml";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toRating = (value) => (value === null || value === "" ? null : Number(value));

export function parsePeriod(period) {
  const [year, mon] = period.split("-");
  const index = MONTHS.indexOf(mon);
  if (!/^\d{4}$/.test(year) || index < 0) throw new Error(`Unrecognised FIDE period: ${period}`);
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

export function normalizeHistory(rows) {
  return rows
    .map((row) => ({
      month: parsePeriod(row.date_2),
      standard: toRating(row.rating),
      rapid: toRating(row.rapid_rtng),
      blitz: toRating(row.blitz_rtng),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchHistory(fideId) {
  const res = await fetch(`${HISTORY_URL}?event=${fideId}&period=0`, {
    headers: { "User-Agent": "Mozilla/5.0 (rating-bounty)", "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`FIDE responded ${res.status}`);
  const rows = JSON.parse((await res.text()).replace(/^﻿/, ""));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`FIDE returned no history for ${fideId}`);
  return normalizeHistory(rows);
}
```

An empty or failed response throws, so the job fails loudly and the last good `data.json` stays published.

- [x] **Step 5: Implement `src/report.mjs`**

```js
import { TIERS, computeCategory } from "./earnings.mjs";

const CATEGORY_NAMES = { standard: "Standard", rapid: "Rapid", blitz: "Blitz" };

export function buildReport(config, history, updatedAt) {
  const categories = {};
  for (const [key, options] of Object.entries(config.categories)) {
    const series = history.map((h) => ({ month: h.month, rating: h[key] }));
    categories[key] = { name: CATEGORY_NAMES[key], ...computeCategory(series, options.start) };
  }
  return {
    player: config.player,
    updatedAt,
    tiers: TIERS,
    months: history.map((h) => h.month),
    categories,
    total: Object.values(categories).reduce((sum, c) => sum + c.total, 0),
  };
}
```

- [x] **Step 6: Run `npm test`.** Expected: 9 passing.
- [x] **Step 7: Commit** with `git commit -m "feat: FIDE history client and report builder"`

### Task 4: Update script

**Files:**
- Create: `scripts/update.mjs`

- [x] **Step 1: Implement**

```js
import { readFile, writeFile } from "node:fs/promises";
import { fetchHistory } from "../src/fide.mjs";
import { buildReport } from "../src/report.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("config.json", root), "utf8"));
const history = await fetchHistory(config.player.fideId);
const report = buildReport(config, history, new Date().toISOString().slice(0, 10));

await writeFile(new URL("site/data.json", root), JSON.stringify(report, null, 2) + "\n");
console.log(`Ratings to ${report.months.at(-1)}, total earned €${report.total}`);
```

- [x] **Step 2: Run `npm run update`.** Expected: `Ratings to 2026-09, total earned €2560`.
- [x] **Step 3: Commit** with `git commit -m "feat: monthly update script and first data snapshot"`

### Task 5: Dashboard

**Files:**
- Create: `site/index.html`
- Reference: `docs/design/mockup.html` (the approved mockup)

The page reuses the mockup's `<style>` block unchanged, apart from dropping the `.sample` badge and adding `a` and `.error` rules. The script changes from the mockup are:

- [x] **Step 1: Load real data.** Replace the seeded random walk with `await fetch("data.json")` in a `<script type="module">`. If the load fails, show an inline error. Build `CATS` from `data.categories`: `r`, `rec`, `gain` and `cum` come from each month's `rating`, `record`, `earned` and `total`, and `ledger` comes from `payouts` with `i = data.months.indexOf(p.month)`.
- [x] **Step 2: Take the tiers from the data.** Build `TIERS` from `data.tiers` (`to: null` becomes 3000) so the page and the rule cannot drift apart. Generate the footer's rate sentence from the same array.
- [x] **Step 3: Handle unrated months.** Break the rating polyline wherever the rating is `null`, start the record step line at the first non-null record, and have the tooltip say "not rated".
- [x] **Step 4: Fix label collisions.** Put the tier labels at the left of each panel, where the rating line starts low, and skip bands under 16px tall. Push the stacked-area end labels apart by at least 14px.
- [x] **Step 5: Improve the Next-euro copy.** The next-tier hint reads "from 2001: €3/pt" instead of "2000 starts". The ledger shows every payout, with a total row.
- [x] **Step 6: Verify.** Run `node --check` on the extracted script. Serve `site/` locally and take Playwright screenshots at 900px (light) and 390px (dark). Check for label overlap and horizontal page scroll.
- [x] **Step 7: Commit** with `git commit -m "feat: rating bounty dashboard"`

### Task 7: Move the monthly fetch to the owner's PC

- [x] **Step 1:** Remove `schedule` and the fetch/commit steps from the workflow, and scope permissions per job.
- [x] **Step 2:** Add `scripts/monthly.ps1` and register the scheduled task (see README).
- [x] **Step 3:** Run the task once. Expected: the log shows `Ratings to <month>`, and a data change is pushed and deployed.

### Task 6: Schedule and publish

**Files:**
- Create: `.github/workflows/update.yml`, `README.md`

- [x] **Step 1: Write the workflow.** It has one `build` job: checkout, Node 24, `npm test`, then `npm run update` and commit `site/data.json` when the data changed (schedule and manual runs only), then `upload-pages-artifact` of `site/`. A `deploy` job then runs `actions/deploy-pages`. On a push to `main`, it tests and redeploys without fetching.
- [x] **Step 2: Create the repo and enable Pages**

```sh
gh repo create tomyka/PauliusChess --public --source . --push
gh api -X POST repos/tomyka/PauliusChess/pages -f build_type=workflow
gh workflow run update.yml
```

- [x] **Step 3: Verify.** `gh run watch` should end green. `curl -s https://tomyka.github.io/PauliusChess/data.json` should return the current month.

## Open questions for the owner

1. **Past payouts.** Your sheet paid a flat €3 per point. The dashboard currently recalculates all history with the tiers, which gives €2,560. To keep what was already paid, add a `start` per type in `config.json` with the month and record you settled at.
2. **The March 2024 FIDE adjustment.** In March 2024 FIDE raised every rating below 2000 (Rapid went from 1080 to 1448 with 0 games played). Under the current rule, that jump pays €295 in Rapid. If it should not count, set Rapid's `start` to `{ "month": "2024-03", "record": 1448 }`.
