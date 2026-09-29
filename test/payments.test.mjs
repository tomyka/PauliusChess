import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseAmount, paymentsFromYearTab, paymentsFromTabs, yearTabUrl } from "../site/payments.mjs";

// The 2026 tab as it stood on 2026-09-29, in the shape gviz exports it.
const TAB_2026 = `"Menuo","Standart","Rapid","Blitz","Reward","Paid","Remainder"
"TOP","2070","2029","1965","","","0"
"Gruodis","1844","1869","1782","0","0","0"
"Sausis","1843","1829","1855","128","128","0"
"Vasaris","1821","1844","1786","0","0","0"
"Kovas","1768","1844","1786","0","0","0"
"Balandis","1781","1840","1786","0","0","0"
"Gegužė","1813","1862","1786","0","0","0"
"Birželis","1825","1942","1853","146","146","0"
"Liepa","1825","1911","1839","0","0","0"
"Rugpjūtis","1939","1964","1965","454","170","284"
"Rugsėjis","2070","2029","1965","491","200","575"
"Spalis","","","","0","0","575"
"Lapkritis","","","","0","0","575"
"Gruodis","","","","0","0","575"`;

test("CSV fields may be quoted and hold commas, quotes and newlines", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n\n1,2'), [["a", "b"], ["x, y", 'say "hi"\nthere'], ["1", "2"]]);
});

test("amounts accept a decimal comma and a euro sign; blanks are zero", () => {
  assert.equal(parseAmount("150"), 150);
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("€ 1 000"), 1000);
  for (const blank of ["", "0", "-5", "abc", undefined]) assert.equal(parseAmount(blank), 0, String(blank));
});

test("a year tab gives that year's payments dated at month end", () => {
  assert.deepEqual(paymentsFromYearTab(TAB_2026, 2026), [
    { date: "2026-01-31", eur: 128 },
    { date: "2026-06-30", eur: 146 },
    { date: "2026-08-31", eur: 170 },
    { date: "2026-09-30", eur: 200 },
  ]);
});

test("the carry-over December at the top of a tab is not counted again", () => {
  const tab = `"Menuo","Paid"\n"Gruodis","220"\n"Sausis","5"\n"Gruodis","7"`;
  assert.deepEqual(paymentsFromYearTab(tab, 2026), [{ date: "2026-01-31", eur: 5 }, { date: "2026-12-31", eur: 7 }]);
});

test("a tab without a Paid column is an error, not zero payments", () => {
  assert.throws(() => paymentsFromYearTab(`"Menuo","Reward"\n"Sausis","5"`, 2026), /no Paid column/);
});

test("tabs are addressed by year name", () => {
  assert.equal(yearTabUrl("abc", 2026), "https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv&sheet=2026");
});

test("a missing year tab, which Google answers with the first tab, is not counted twice", () => {
  const tabs = [{ year: 2026, csv: TAB_2026 }, { year: 2027, csv: TAB_2026 }];
  assert.equal(paymentsFromTabs(tabs).reduce((s, p) => s + p.eur, 0), 128 + 146 + 170 + 200);
});
