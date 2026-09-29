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

## Configuration

`config.json` holds the player and one entry per rating type. To start counting from an agreed point, rather than from the first FIDE rating, give that type a `start`:

```json
"standard": { "start": { "month": "2026-09", "record": 2070 } }
```

Months up to and including `month` then pay nothing, and `record` is the record to beat from the next month.

## Local use

Needs Node 22 or newer. There are no dependencies.

```sh
npm test         # earnings rule and FIDE parsing
npm run update   # fetch live data into site/data.json
npm run preview  # serve site/ locally
```

The implementation plan is in `docs/superpowers/plans/`. The original design mockup is in `docs/design/mockup.html`.
