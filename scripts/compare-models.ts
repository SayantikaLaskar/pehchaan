// Is the model actually better than simple rules? Compare on two datasets, out of sample:
//  - the demo shop (calibrate to 1 Jun 2026, test 1 Jun – 15 Aug)
//  - real CDNOW purchases (calibrate weeks 1–39, test weeks 40–78)
// Metrics: forecast error on test-period visits, and AUC for spotting who made no visits.
import { readFileSync, writeFileSync } from "node:fs";
import { expectedVisits, expectedVisitsMBG, fitBG, fitMBG, pAlive, pAliveMBG, totalLL, type RFM } from "../src/lib/pehchaan/btyd";
import { CAL_END, HOLD_END, rfm } from "../src/lib/pehchaan/model";
import { DAY, customers } from "../src/lib/pehchaan/sim";

interface Row { r: RFM; actual: number }

function auc(score: number[], positive: boolean[]) {
  const pos = score.filter((_, i) => positive[i]), neg = score.filter((_, i) => !positive[i]);
  let win = 0;
  for (const p of pos) for (const n of neg) win += p > n ? 1 : p === n ? 0.5 : 0;
  return win / (pos.length * neg.length);
}

function evaluate(name: string, rows: Row[], h: number) {
  const data = rows.map((x) => x.r), act = rows.map((x) => x.actual);
  const gone = act.map((a) => a === 0); // made no visits in the test period
  const mae = (pred: number[]) => pred.reduce((s, p, i) => s + Math.abs(p - act[i]), 0) / rows.length;
  const total = (pred: number[]) => pred.reduce((s, p) => s + p, 0);

  const bg = fitBG(data), mbg = fitMBG(data);
  const avgRate = data.map((r) => ((r.x + 1) / Math.max(r.T, 1)) * h); // naive: keep buying at your average rate
  const recency = data.map((r) => (r.T - r.tx) / Math.max(1, r.x > 0 ? r.tx / r.x : r.T)); // "away longer than usual"
  const pBG = data.map((r) => expectedVisits(bg, r, h)), pMBG = data.map((r) => expectedVisitsMBG(mbg, r, h));
  const actual = total(act);

  const models = [
    { model: "Average rate (rule)", mae: mae(avgRate), totalErr: total(avgRate) / actual - 1, auc: auc(avgRate.map((v) => -v), gone) },
    { model: "Recency rule", mae: null, totalErr: null, auc: auc(recency, gone) },
    { model: "BG/NBD", mae: mae(pBG), totalErr: total(pBG) / actual - 1, auc: auc(data.map((r) => 1 - pAlive(bg, r)), gone), ll: totalLL("bg", bg, data) },
    { model: "MBG/NBD", mae: mae(pMBG), totalErr: total(pMBG) / actual - 1, auc: auc(data.map((r) => 1 - pAliveMBG(mbg, r)), gone), ll: totalLL("mbg", mbg, data) },
    { model: "MBG/NBD · ranked by expected visits", mae: mae(pMBG), totalErr: total(pMBG) / actual - 1, auc: auc(pMBG.map((v) => -v), gone), ll: totalLL("mbg", mbg, data) },
    { model: "BG/NBD · ranked by expected visits", mae: mae(pBG), totalErr: total(pBG) / actual - 1, auc: auc(pBG.map((v) => -v), gone), ll: totalLL("bg", bg, data) },
  ];
  console.log(`\n${name} — ${rows.length} customers, ${actual} test-period visits, ${gone.filter(Boolean).length} made none`);
  console.table(models.map((m) => ({ model: m.model, MAE: m.mae?.toFixed(3) ?? "—", "total error": m.totalErr == null ? "—" : `${(m.totalErr * 100).toFixed(1)}%`, AUC: m.auc.toFixed(3), LL: m.ll?.toFixed(0) ?? "" })));
  return { name, customers: rows.length, actual, gone: gone.filter(Boolean).length, models };
}

// Demo shop
const shop = customers().map((c) => ({ c, r: rfm(c, CAL_END) })).filter((x): x is { c: (typeof x)["c"]; r: RFM } => !!x.r)
  .map(({ c, r }) => ({ r, actual: c.visits.filter((v) => v.t > CAL_END && v.t <= HOLD_END).length }));
const a = evaluate("Demo shop", shop, (HOLD_END - CAL_END) / DAY);

// CDNOW
const WEEK = 7 * DAY, START = Date.UTC(1997, 0, 1), CE = START + 39 * WEEK, HE = START + 78 * WEEK;
const days = new Map<string, Set<number>>();
for (const line of readFileSync("data/cdnow/CDNOW_sample.txt", "utf8").split(/\r?\n/)) {
  const p = line.trim().split(/\s+/);
  if (p.length < 5) continue;
  const t = Date.UTC(+p[2].slice(0, 4), +p[2].slice(4, 6) - 1, +p[2].slice(6, 8));
  if (!days.has(p[0])) days.set(p[0], new Set());
  days.get(p[0])!.add(t);
}
const cd: Row[] = [];
for (const set of days.values()) {
  const ts = [...set].sort((x, y) => x - y), cal = ts.filter((t) => t < CE);
  if (!cal.length) continue;
  cd.push({ r: { x: cal.length - 1, tx: (cal[cal.length - 1] - cal[0]) / WEEK, T: (CE - cal[0]) / WEEK, mx: 0 }, actual: ts.filter((t) => t >= CE && t < HE).length });
}
const b = evaluate("CDNOW (real)", cd, 39);

writeFileSync("src/lib/pehchaan/model-comparison.json", JSON.stringify([a, b], null, 1));
