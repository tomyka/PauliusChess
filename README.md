# Paulius Rating Bounty

A shareable dashboard of Paulius Konovalovas's FIDE ratings ([FIDE ID 12859168](https://ratings.fide.com/profile/12859168)) and the money earned for each new record.

## The agreement

- Each rating type (Standard, Rapid, Blitz) keeps its own record and its own total.
- A new record pays for every point above the old record, each at its tier rate:
  €1 per point up to 1800, €2 for 1801-2000, €3 for 2001-2200, €4 for 2201-2400, €5 above 2400.
- A record never goes down. After a drop, nothing pays until the old record is beaten.
- The first published rating in a type sets the starting record and pays nothing.

The rule lives in `src/earnings.mjs` and is covered by `test/earnings.test.mjs`.

## How it runs

ratings.fide.com refuses connections from GitHub's cloud runners, so the monthly fetch runs on the owner's Windows PC:

1. On the 2nd of every month at 09:00, the Windows scheduled task "PauliusChess monthly FIDE update" runs `scripts/monthly.ps1`. If the PC is off then, the task runs as soon as the PC is back on.
2. The script pulls, fetches the full history from FIDE (`scripts/update.mjs`), and recomputes `site/data.json`. If anything changed, it commits and pushes. It writes a log to `scripts/monthly.log`.
3. The push triggers `.github/workflows/update.yml`, which runs the tests and publishes `site/` to https://tomyka.github.io/PauliusChess/.

To refresh now: `pwsh scripts/monthly.ps1`, or `Start-ScheduledTask "PauliusChess monthly FIDE update"`.

To set up the task on another PC:

```powershell
schtasks /Create /TN "PauliusChess monthly FIDE update" /SC MONTHLY /D 2 /ST 09:00 /TR "pwsh -NoProfile -ExecutionPolicy Bypass -File D:\Projects\PauliusChess\scripts\monthly.ps1"
Set-ScheduledTask -TaskName "PauliusChess monthly FIDE update" -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries)
```

## Recording a payout

Enter it in the Paid column of the owner's Google Sheet, "Pauliaus FIDE progresas", in that month's row of the year's tab. The dashboard reads the sheet each time the page loads, so there is nothing else to run. A change shows up within a few minutes.

- **Tabs:** one tab per year, named `2025`, `2026` and so on. Months are in Lithuanian (Sausis to Gruodis). The dashboard reads every year from `paymentsSheet.fromYear` in `config.json` up to the latest rating month. A new year's tab needs the same layout: a "Menuo" column of month names and a "Paid" column.
- **Carry-over row:** a tab may begin with the previous December as a carry-over row. It is ignored, so that December is not counted twice.
- **Dates:** each payment is dated the last day of its month.
- **Sharing:** the sheet must stay shared as "Anyone with the link: Viewer". If it can't be read, Owed and Paid show "–" instead of wrong numbers.
- **Code:** `site/payments.mjs`, tested in `test/payments.test.mjs`.

The dashboard shows:

- **Tiles:** owed, earned and paid.
- **Money chart:** a paid step line.
- **Payments table:** each payment's year/month (e.g. 2026/09), amount, and the balance still owed after it.

## Configuration

`config.json` holds the player and one entry per rating type. To start counting from an agreed point, rather than from the first FIDE rating, give that type a `start`:

```json
"standard": { "start": { "month": "2026-09", "record": 2070 } }
```

Months up to and including `month` then pay nothing, and `record` is the record to beat from the next month.

The current baselines come from the owner's "Pauliaus FIDE progresas" sheet: the agreement started in January 2025 at Standard 1479, Rapid 1717 and Blitz 1542. Payments are read live from the same sheet (see Recording a payout).

The update refuses to lower any total already earned. After a deliberate change that lowers totals, such as a new baseline, run `node scripts/update.mjs --accept-lower-totals` once.

## Local use

Needs Node 22 or newer. There are no dependencies.

```sh
npm test         # earnings rule and FIDE parsing
npm run update   # fetch live data into site/data.json
npm run preview  # serve site/ locally
```

The implementation plan is in `docs/superpowers/plans/`. The original design mockup is in `docs/design/mockup.html`.
