import { TIERS, computeCategory } from "./earnings.mjs";

const CATEGORY_NAMES = { standard: "Standard", rapid: "Rapid", blitz: "Blitz" };

// Earned money never goes back: refuse a report that lowers any type's total
// below the last published one (a FIDE revision or a config edit would do that).
export function assertNoLoss(previous, next) {
  for (const [key, before] of Object.entries(previous.categories)) {
    const after = next.categories[key]?.total ?? 0;
    if (after < before.total) throw new Error(`${before.name} total would drop from €${before.total} to €${after}`);
  }
}

// Everything the dashboard draws, from the config and the normalized FIDE history.
export function buildReport(config, history, updatedAt) {
  const categories = {};
  for (const [key, options] of Object.entries(config.categories)) {
    if (!CATEGORY_NAMES[key]) throw new Error(`Unknown rating type in config: ${key}`);
    const series = history.map((h) => ({ month: h.month, rating: h[key] }));
    categories[key] = { name: CATEGORY_NAMES[key], ...computeCategory(series, options.start) };
  }
  return {
    player: config.player,
    repo: config.repo,
    paymentsSheet: config.paymentsSheet,
    updatedAt,
    tiers: TIERS,
    months: history.map((h) => h.month),
    categories,
    total: Object.values(categories).reduce((sum, c) => sum + c.total, 0),
  };
}
