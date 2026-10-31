import { DARK_STORE, DAY, TODAY, customers, type Customer } from "./sim";
import { expectedSpend, expectedVisits, fitBG, fitGG, pAlive, type BGParams, type GGParams, type RFM } from "./btyd";

export type Segment = "champion" | "loyal" | "new" | "at_risk" | "lost";

export const SEGMENTS: Record<Segment, { label: string; color: string; hint: string }> = {
  champion: { label: "Champions", color: "var(--c-sale)", hint: "Frequent, still active" },
  loyal: { label: "Loyal", color: "var(--c-loan)", hint: "Steady regulars" },
  new: { label: "New", color: "var(--c-own)", hint: "First 30 days" },
  at_risk: { label: "At risk", color: "var(--c-personal)", hint: "Probability of still being a regular has fallen" },
  lost: { label: "Lost", color: "var(--c-refund)", hint: "Very unlikely to return on their own" },
};

export const CAL_END = Date.UTC(2026, 5, 1); // backtest: train to 1 Jun …
export const HOLD_END = Date.UTC(2026, 7, 15); // … predict 1 Jun – 15 Aug (before the dark store)
export const SHOCK_CUTOFF = Date.UTC(2026, 7, 15); // model as it stood the week before the opening

export function rfm(c: Customer, cutoff: number): RFM | null {
  const v = c.visits.filter((x) => x.t <= cutoff);
  if (!v.length) return null;
  const first = v[0].t, last = v[v.length - 1].t;
  return {
    x: v.length - 1,
    tx: (last - first) / DAY,
    T: (cutoff - first) / DAY,
    mx: v.reduce((s, x) => s + x.amount, 0) / v.length,
  };
}

export interface Scored {
  c: Customer;
  rfm: RFM;
  pAlive: number;
  pAlive30: number; // a month ago
  next30: number; // expected visits
  spend: number; // expected spend per visit
  clv90: number;
  lastSeen: number; // days
  avgGap: number; // days between visits
  overdue: number; // lastSeen / avgGap
  monthly: number; // historical monthly spend while active
  segment: Segment;
  priority: number; // win-back value
  winnable: boolean; // slipped recently enough to be worth an offer
}

export interface Analysis {
  bg: BGParams;
  gg: GGParams;
  scored: Scored[];
  backtest: Backtest;
  shock: Shock;
}

export interface Backtest {
  params: BGParams;
  n: number;
  predicted: number;
  actual: number;
  mae: number;
  corr: number;
  buckets: { label: string; predicted: number; actual: number; n: number }[];
  topDecileCapture: number; // share of holdout visits made by the model's top-10% customers
}

export interface Shock {
  weekly: { week: number; label: string; actual: number; expected: number | null }[];
  expectedAfter: number;
  actualAfter: number;
  gapPct: number;
  rings: { label: string; gapPct: number; n: number }[];
  detectedWeek: string | null;
}

const fmtWeek = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
};

function pearson(a: number[], b: number[]) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}

export function backtest(all: Customer[], calEnd = CAL_END, holdEnd = HOLD_END): Backtest {
  const rows = all.map((c) => ({ c, r: rfm(c, calEnd) })).filter((x): x is { c: Customer; r: RFM } => !!x.r);
  const params = fitBG(rows.map((x) => x.r));
  const h = (holdEnd - calEnd) / DAY;
  const pred = rows.map((x) => expectedVisits(params, x.r, h));
  const act = rows.map((x) => x.c.visits.filter((v) => v.t > calEnd && v.t <= holdEnd).length);
  const bins = [[0, 0], [1, 2], [3, 5], [6, 10], [11, 20], [21, 40], [41, 1e9]];
  const buckets = bins.map(([lo, hi]) => {
    const idx = rows.map((x, i) => (x.r.x >= lo && x.r.x <= hi ? i : -1)).filter((i) => i >= 0);
    const avg = (arr: number[]) => (idx.length ? idx.reduce((s, i) => s + arr[i], 0) / idx.length : 0);
    return { label: hi > 1e8 ? `${lo}+` : lo === hi ? `${lo}` : `${lo}–${hi}`, predicted: avg(pred), actual: avg(act), n: idx.length };
  }).filter((b) => b.n > 0);
  const order = pred.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, Math.ceil(rows.length / 10)).map(([, i]) => i);
  const totalAct = act.reduce((s, x) => s + x, 0);
  return {
    params,
    n: rows.length,
    predicted: pred.reduce((s, x) => s + x, 0),
    actual: totalAct,
    mae: pred.reduce((s, p, i) => s + Math.abs(p - act[i]), 0) / rows.length,
    corr: pearson(pred, act),
    buckets,
    topDecileCapture: order.reduce((s, i) => s + act[i], 0) / totalAct,
  };
}

function shock(all: Customer[]): Shock {
  const rows = all.map((c) => ({ c, r: rfm(c, SHOCK_CUTOFF) })).filter((x): x is { c: Customer; r: RFM } => !!x.r);
  const params = fitBG(rows.map((x) => x.r));
  const start = Date.UTC(2026, 1, 2); // weekly series from Feb (Mondays)
  const weekly: Shock["weekly"] = [];
  for (let w = start, i = 0; w + 7 * DAY <= TODAY + DAY; w += 7 * DAY, i++) {
    const actual = all.reduce((s, c) => s + c.visits.filter((v) => v.t >= w && v.t < w + 7 * DAY).length, 0);
    let expected: number | null = null;
    if (w >= SHOCK_CUTOFF) {
      const a = (w - SHOCK_CUTOFF) / DAY, b = a + 7;
      expected = rows.reduce((s, x) => s + expectedVisits(params, x.r, b) - expectedVisits(params, x.r, a), 0);
    }
    weekly.push({ week: w, label: fmtWeek(w), actual, expected });
  }
  const h = (TODAY - SHOCK_CUTOFF) / DAY;
  const per = rows.map((x) => ({
    d: Math.hypot(x.c.x - DARK_STORE.x, x.c.y - DARK_STORE.y),
    e: expectedVisits(params, x.r, h),
    a: x.c.visits.filter((v) => v.t > SHOCK_CUTOFF).length,
  }));
  const ring = (lo: number, hi: number, label: string) => {
    const g = per.filter((p) => p.d >= lo && p.d < hi);
    const e = g.reduce((s, p) => s + p.e, 0), a = g.reduce((s, p) => s + p.a, 0);
    return { label, gapPct: e ? (a - e) / e : 0, n: g.length };
  };
  const expectedAfter = per.reduce((s, p) => s + p.e, 0), actualAfter = per.reduce((s, p) => s + p.a, 0);
  // Two consecutive weeks more than 8% below what the model expected.
  const below = (w?: Shock["weekly"][number]) => !!w?.expected && w.actual < w.expected * 0.92;
  const det = weekly.find((w, i) => below(w) && below(weekly[i + 1]));
  return {
    weekly,
    expectedAfter,
    actualAfter,
    gapPct: (actualAfter - expectedAfter) / expectedAfter,
    rings: [ring(0, 500, "< 500 m"), ring(500, 1000, "0.5–1 km"), ring(1000, 1500, "1–1.5 km"), ring(1500, 1e9, "> 1.5 km")],
    detectedWeek: det ? det.label : null,
  };
}

let cache: Analysis | null = null;

/** Fit both models on any merchant's customers and score each one as of `today`. */
export function scoreAll(all: Customer[], today: number) {
  const rows = all.filter((c) => c.visits.length && c.visits[0].t <= today).map((c) => ({ c, r: rfm(c, today)! }));
  const bg = fitBG(rows.map((x) => x.r));
  const gg = fitGG(rows.map((x) => x.r));

  const scored: Scored[] = rows.map(({ c, r }) => {
    const r30 = rfm(c, today - 30 * DAY);
    const pa = pAlive(bg, r);
    const pa30 = r30 ? pAlive(bg, r30) : pa;
    const spend = expectedSpend(gg, r);
    const next30 = expectedVisits(bg, r, 30);
    const lastSeen = (today - c.visits[c.visits.length - 1].t) / DAY;
    const avgGap = r.x > 0 ? r.tx / r.x : r.T;
    const activeDays = Math.max(30, r.tx + avgGap);
    const monthly = (c.visits.reduce((s, v) => s + v.amount, 0) / activeDays) * 30;
    const segment: Segment =
      r.T < 30 ? "new" : pa < 0.3 ? "lost" : pa < 0.7 || pa30 - pa > 0.25 ? "at_risk" : next30 >= 5 ? "champion" : "loyal";
    // Worth winning back: was valuable, and not yet gone for good.
    const recoverable = lastSeen > 120 ? 0 : pa > 0.08 ? 1 : 0.3;
    return {
      c, rfm: r, pAlive: pa, pAlive30: pa30, next30, spend, clv90: expectedVisits(bg, r, 90) * spend,
      lastSeen, avgGap, overdue: lastSeen / Math.max(1, avgGap), monthly, segment,
      priority: segment === "at_risk" || segment === "lost" ? (1 - pa) * monthly * recoverable : 0,
      winnable: (segment === "at_risk" || segment === "lost") && lastSeen <= 90,
    };
  });
  return { bg, gg, scored };
}

export function analyse(): Analysis {
  if (cache) return cache;
  const all = customers();
  cache = { ...scoreAll(all, TODAY), backtest: backtest(all), shock: shock(all) };
  return cache;
}

/** P(alive) for one customer on every day of the last `days` days — for the decay chart. */
export function aliveCurve(s: Scored, bg: BGParams, days = 180) {
  const out: { t: number; p: number; visit: boolean }[] = [];
  for (let k = days; k >= 0; k--) {
    const t = TODAY - k * DAY;
    const r = rfm(s.c, t);
    if (!r) continue;
    out.push({ t, p: pAlive(bg, r), visit: s.c.visits.some((v) => v.t > t - DAY && v.t <= t) });
  }
  return out;
}
