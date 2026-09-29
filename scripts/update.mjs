// Monthly job: fetch the FIDE history, recompute earnings, write site/data.json.
import { readFile, writeFile } from "node:fs/promises";
import { fetchHistory } from "../src/fide.mjs";
import { assertNoLoss, buildReport } from "../src/report.mjs";

const root = new URL("../", import.meta.url);
const dataFile = new URL("site/data.json", root);
const config = JSON.parse(await readFile(new URL("config.json", root), "utf8"));
const history = await fetchHistory(config.player.fideId);
const report = buildReport(config, history, new Date().toISOString().slice(0, 10));

const previous = await readFile(dataFile, "utf8").then(JSON.parse, () => null);
// --accept-lower-totals: for a deliberate config change (e.g. a new baseline), never for the monthly run.
if (previous && !process.argv.includes("--accept-lower-totals")) assertNoLoss(previous, report);

await writeFile(dataFile, JSON.stringify(report, null, 2) + "\n");
console.log(`Ratings to ${report.months.at(-1)}, total earned €${report.total}`);
