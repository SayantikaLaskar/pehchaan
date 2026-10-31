// Validate our BG/NBD implementation on real purchase data: the CDNOW sample used in
// Fader, Hardie & Lee (2005). Fit on weeks 1–39, predict weeks 40–78, compare with the
// parameters published in the paper. Writes src/lib/pehchaan/cdnow-validation.json.
import { readFileSync, writeFileSync } from "node:fs";
import { expectedVisits, fitBG, pAlive, type RFM } from "../src/lib/pehchaan/btyd";

const DAY = 86_400_000, WEEK = 7 * DAY;
const START = Date.UTC(1997, 0, 1);
const CAL_END = START + 39 * WEEK;
const HOLD_END = START + 78 * WEEK;
const PUBLISHED = { r: 0.243, alpha: 4.414, a: 0.793, b: 2.426 }; // Fader, Hardie & Lee (2005), Table 1

const days = new Map<string, Set<number>>();
for (const line of readFileSync("data/cdnow/CDNOW_sample.txt", "utf8").split(/\r?\n/)) {
  const p = line.trim().split(/\s+/);
  if (p.length < 5) continue;
  const d = p[2];
  const t = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
  if (!days.has(p[0])) days.set(p[0], new Set());
  days.get(p[0])!.add(t); // same-day purchases count once, as in the paper
}

const rows: { rfm: RFM; holdout: number }[] = [];
for (const set of days.values()) {
  const ts = [...set].sort((a, b) => a - b);
  const cal = ts.filter((t) => t < CAL_END);
  if (!cal.length) continue;
  const first = cal[0], last = cal[cal.length - 1];
  rows.push({
    rfm: { x: cal.length - 1, tx: (last - first) / WEEK, T: (CAL_END - first) / WEEK, mx: 0 },
    holdout: ts.filter((t) => t >= CAL_END && t < HOLD_END).length,
  });
}

const fit = fitBG(rows.map((r) => r.rfm));
const pred = rows.map((r) => expectedVisits(fit, r.rfm, 39));
const act = rows.map((r) => r.holdout);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const buckets = [0, 1, 2, 3, 4, 5, 6].map((k) => {
  const idx = rows.map((r, i) => ((k < 6 ? r.rfm.x === k : r.rfm.x >= 6) ? i : -1)).filter((i) => i >= 0);
  return { label: k < 6 ? String(k) : "6+", n: idx.length, predicted: sum(idx.map((i) => pred[i])) / idx.length, actual: sum(idx.map((i) => act[i])) / idx.length };
});
const ma = sum(pred) / pred.length, mb = sum(act) / act.length;
const corr = sum(pred.map((p, i) => (p - ma) * (act[i] - mb))) / Math.sqrt(sum(pred.map((p) => (p - ma) ** 2)) * sum(act.map((a) => (a - mb) ** 2)));

const out = {
  dataset: "CDNOW sample (2,357 customers, Jan 1997 – Jun 1998)",
  source: "Fader, Hardie & Lee (2005), via the lifetimes library",
  customers: rows.length,
  transactions: sum(rows.map((r) => r.rfm.x + 1)) + sum(act),
  ours: fit,
  published: PUBLISHED,
  holdout: { predicted: sum(pred), actual: sum(act), corr },
  buckets,
  pAliveExample: pAlive(fit, { x: 2, tx: 30.43, T: 38.86, mx: 0 }),
};
writeFileSync("src/lib/pehchaan/cdnow-validation.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ customers: out.customers, ours: Object.fromEntries(Object.entries(fit).map(([k, v]) => [k, +v.toFixed(3)])), published: PUBLISHED, holdout: { predicted: +out.holdout.predicted.toFixed(0), actual: out.holdout.actual, corr: +corr.toFixed(3) } }, null, 1));
console.table(buckets.map((b) => ({ ...b, predicted: +b.predicted.toFixed(2), actual: +b.actual.toFixed(2) })));
