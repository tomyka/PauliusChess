// Payments come from the owner's "Pauliaus FIDE progresas" Google Sheet: one tab per year
// (named "2025", "2026", ...), one row per month (Lithuanian month names), and a Paid column.
// Runs in the browser (site/index.html) and under node:test. Payment: { date: "YYYY-MM-DD", eur }.

// A tab by name as CSV. Needs the sheet shared as "Anyone with the link: Viewer".
export const yearTabUrl = (sheetId, year) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${year}`;

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// "150", "12,50", "€ 1 000" -> number; empty, zero or unreadable -> 0.
export function parseAmount(value) {
  const s = String(value ?? "").replace(/[€\s ]/g, "").replace(",", ".");
  const n = /^\d+(\.\d+)?$/.test(s) ? Number(s) : 0;
  return Math.round(n * 100) / 100;
}

const MONTHS_LT = ["sausis", "vasaris", "kovas", "balandis", "gegužė", "birželis", "liepa", "rugpjūtis", "rugsėjis", "spalis", "lapkritis", "gruodis"];
const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

// One year tab -> that year's payments, each dated the last day of its month.
// A tab may open with the previous December as a carry-over row (before "Sausis"); it belongs
// to the previous tab, so it is skipped rather than counted twice.
export function paymentsFromYearTab(csv, year) {
  const [header = [], ...rows] = parseCsv(csv);
  const paidCol = header.findIndex((h) => /^(paid|sumokėta)$/i.test(h.trim()));
  if (paidCol < 0) throw new Error(`Tab ${year} has no Paid column (headers: ${header.join(", ")})`);
  const payments = [];
  let seenJanuary = false;
  for (const row of rows) {
    const month = MONTHS_LT.indexOf((row[0] ?? "").trim().toLocaleLowerCase("lt")) + 1;
    if (!month) continue; // "TOP" and other non-month rows
    if (month === 1) seenJanuary = true;
    if (!seenJanuary) continue;
    const eur = parseAmount(row[paidCol]);
    if (eur > 0) payments.push({ date: lastDay(year, month), eur });
  }
  return payments;
}

// tabs: [{ year, csv }] in ascending year order. A tab name that doesn't exist yet (say "2027"
// in January) makes Google return the first tab instead of an error, so a year whose content
// is identical to an earlier year's is taken as missing. Earlier years always exist, since
// the fetch starts at the agreement's first year.
export function paymentsFromTabs(tabs) {
  const seen = new Set();
  return tabs.flatMap(({ year, csv }) => {
    if (seen.has(csv)) return [];
    seen.add(csv);
    return paymentsFromYearTab(csv, year);
  });
}
