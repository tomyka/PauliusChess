// FIDE's rating-history endpoint, the one behind the chart on ratings.fide.com/profile/<id>/chart.
const HISTORY_URL = "https://ratings.fide.com/a_chart_data.phtml";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toRating = (value) => (value === null || value === "" ? null : Number(value));

// "2024-Jan" -> "2024-01"
export function parsePeriod(period) {
  const [year, mon] = period.split("-");
  const index = MONTHS.indexOf(mon);
  if (!/^\d{4}$/.test(year) || index < 0) throw new Error(`Unrecognised FIDE period: ${period}`);
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

// Raw FIDE rows -> [{ month, standard, rapid, blitz }] in ascending month order.
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
