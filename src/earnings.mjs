// The pay agreement: each rating point above the record pays the rate of the
// tier that point falls in. Tiers are inclusive at the top: 1800 pays €1, 1801 pays €2.
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

// Euros for climbing from `from` to `to`: points from+1 .. to, each at its own tier rate.
export function earningsBetween(from, to) {
  let sum = 0;
  for (let point = from + 1; point <= to; point++) sum += ratePerPoint(point);
  return sum;
}

// series: [{ month: "YYYY-MM", rating: number | null }] in ascending month order.
// start (optional): { month, record } — nothing up to and including `month` pays,
// and `record` is the record in force after it. Without it, the first published
// rating sets the record and pays nothing.
export function computeCategory(series, start) {
  let record = start ? start.record : null;
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
