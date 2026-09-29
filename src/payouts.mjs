// Money actually handed over. Earnings are per rating type; payments only reduce the total owed.
// Entry: { date: "YYYY-MM-DD", eur: number, note?: string }, kept in date order.

export function parsePayout({ date, eur, note }) {
  const day = String(date ?? "").trim();
  const parsed = new Date(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new Error(`Date must be a real YYYY-MM-DD date, got "${date}"`);
  }
  const amount = Number(String(eur ?? "").trim().replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw new Error(`Amount must be a positive number of euros with at most 2 decimals, got "${eur}"`);
  }
  const text = String(note ?? "").trim();
  return text ? { date: day, eur: amount, note: text } : { date: day, eur: amount };
}

// Stable: a payout on the same date as existing ones goes after them.
export function addPayout(list, entry) {
  return [...list, parsePayout(entry)].sort((a, b) => a.date.localeCompare(b.date));
}
