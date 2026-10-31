// Shocks the churn model must not mistake for churn.
// A dark store pulls regulars from shops near one point (local). A lockdown, flood or strike drops
// almost every shop in the city in the same week (city-wide). A Soundbox that loses network drops
// one shop to zero while its neighbours carry on (outage). Paytm sees all three across merchants,
// classifies them, and only the first one should trigger win-back offers.
import { DAY, TODAY, customers, rng, type Customer } from "./sim";
import { WEEK0, WEEKS, network, weekLabel, type Merchant } from "./network";
import { rfm } from "./model";
import { pAliveMBG as pAlive, fitMBG } from "./btyd";

export type ShockKind = "local" | "citywide" | "outage";

export interface Scenario {
  kind: ShockKind;
  title: string;
  window: [number, number] | null; // calendar window of the disruption
  activity: number; // share of normal activity during the window, measured from the network
}

const WEEK = 7 * DAY;
// Hypothetical six-week lockdown, and a three-day Soundbox outage, on the same shop and dates.
export const LOCKDOWN: [number, number] = [Date.UTC(2026, 7, 31), Date.UTC(2026, 9, 12)];
export const OUTAGE: [number, number] = [Date.UTC(2026, 9, 12), Date.UTC(2026, 9, 19)];

/** The same shop's customers with the disruption applied: visits in the window thinned to `keep`. */
export function disrupt(all: Customer[], [a, b]: [number, number], keep: number, seed = 5): Customer[] {
  const r = rng(seed);
  return all.map((c) => ({ ...c, visits: c.visits.filter((v) => v.t < a || v.t >= b || r() < keep) })).filter((c) => c.visits.length);
}

/**
 * Business time: days inside the window only count for the share of trade that actually happened.
 * A 42-day lockdown at 30% activity ages every customer by ~13 days, not 42.
 */
export function warp(t: number, [a, b]: [number, number], activity: number) {
  const inside = Math.max(0, Math.min(t, b) - a);
  return t - inside * (1 - activity);
}
export function warpAll(all: Customer[], win: [number, number], activity: number): Customer[] {
  return all.map((c) => ({ ...c, joined: warp(c.joined, win, activity), visits: c.visits.map((v) => ({ ...v, t: warp(v.t, win, activity) })) }));
}

/* ───────────── network classification ───────────── */

export interface Classification {
  kind: ShockKind;
  breadth: number; // share of merchants flagged in the same weeks
  flagged: number;
  total: number;
  spatial: number; // R² of the distance-decay fit: high = one source, low = everywhere at once
  activity: number; // city index during the disruption vs baseline
  onset: string | null;
  index: number[]; // city-wide weekly index (median merchant)
}

function detect(ms: { weekly: number[] }[]) {
  return ms.map((m) => {
    const base = m.weekly.slice(0, 12), mu = base.reduce((s, v) => s + v, 0) / 12;
    const sd = Math.sqrt(base.reduce((s, v) => s + (v - mu) ** 2, 0) / 12) || 1;
    let cus = 0, onset: number | null = null, minDrop = 0;
    for (let w = 12; w < m.weekly.length; w++) {
      cus = Math.min(0, cus + (m.weekly[w] - mu) / sd + 0.5);
      if (onset == null && cus < -4) onset = w;
      minDrop = Math.min(minDrop, (m.weekly[w] - mu) / mu);
    }
    // A change point only counts when the drop is material, as on the radar.
    return { onset: minDrop < -0.1 ? onset : null, drop: minDrop };
  });
}

/** R² of the best single-source exponential decay — the radar's own triangulation, reused as a test. */
function spatialFit(ms: Merchant[], drops: number[]) {
  const y = drops.map((d) => -d), my = y.reduce((s, v) => s + v, 0) / y.length;
  const tot = y.reduce((s, v) => s + (v - my) ** 2, 0) || 1e-9;
  let best = 0;
  for (let gx = -2200; gx <= 2200; gx += 100)
    for (let gy = -2200; gy <= 2200; gy += 100)
      for (const L of [400, 700, 1000]) {
        const f = ms.map((m) => Math.exp(-Math.hypot(m.x - gx, m.y - gy) / L));
        const A = f.reduce((s, v, i) => s + v * y[i], 0) / f.reduce((s, v) => s + v * v, 0);
        const res = f.reduce((s, v, i) => s + (A * v - y[i]) ** 2, 0);
        best = Math.max(best, 1 - res / tot);
      }
  return best;
}

export function classify(ms: Merchant[]): Classification {
  const det = detect(ms);
  const selfIdx = ms.findIndex((m) => m.self);
  const peers = ms.map((m, i) => ({ m, d: det[i] })).filter((x) => !x.m.self);
  const flagged = peers.filter((x) => x.d.onset != null);
  const breadth = flagged.length / peers.length;
  const spatial = spatialFit(peers.map((x) => x.m), peers.map((x) => x.d.drop));
  const index = Array.from({ length: WEEKS }, (_, w) => {
    const v = peers.map((x) => x.m.weekly[w]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
  const low = Math.min(...index.slice(12));
  const onsets = flagged.map((x) => x.d.onset!).sort((a, b) => a - b);
  // One shop at zero while its peers are normal is a device or network problem, not customers leaving.
  const selfDark = selfIdx >= 0 && det[selfIdx].drop < -0.9 && breadth < 0.2;
  const kind: ShockKind = selfDark ? "outage" : breadth >= 0.5 && spatial < 0.6 ? "citywide" : "local";
  return { kind, breadth, flagged: flagged.length, total: peers.length, spatial, activity: low / 100, onset: onsets.length ? weekLabel(onsets[Math.floor(onsets.length / 2)]) : null, index };
}

/** The same 36 merchants under a city-wide lockdown: every category falls at once, pharmacies hold. */
export function lockdownNetwork(): Merchant[] {
  const r = rng(11);
  const keep: Record<string, number> = { Kirana: 0.45, Grocery: 0.5, Dairy: 0.7, Vegetables: 0.5, Fruits: 0.4, Bakery: 0.25, Café: 0.08, Pharmacy: 1.05, Food: 0.15, Stationery: 0.1 };
  const [a, b] = LOCKDOWN;
  return network().merchants.map((m) => ({
    ...m,
    weekly: Array.from({ length: WEEKS }, (_, w) => {
      const t = WEEK0 + w * WEEK;
      const k = t >= a && t < b ? keep[m.cat] ?? 0.4 : 1;
      return 100 * k * (1 + (r() - 0.5) * 0.07);
    }),
  }));
}

/** One merchant's Soundbox goes dark for a week; the neighbourhood carries on. */
export function outageNetwork(): Merchant[] {
  const [a, b] = OUTAGE;
  const r = rng(13);
  return network().merchants.map((m) => ({
    ...m,
    weekly: Array.from({ length: WEEKS }, (_, w) => {
      const t = WEEK0 + w * WEEK;
      if (m.self && t >= a && t < b) return 0;
      return m.self ? 100 * (1 + (r() - 0.5) * 0.07) : 100 * (1 + (r() - 0.5) * 0.07);
    }),
  }));
}

/* ───────────── what the churn model would do ───────────── */

export interface AlarmSeries {
  // Customers flagged "slipping away" each week: with no disruption, and with it (calendar vs business time).
  weeks: { label: string; t: number; baseline: number; naive: number; aware: number }[];
  peakNaive: number; // worst week: extra flags caused by the disruption alone
  peakAware: number;
  falseAlarmsAvoided: number;
}

const atRisk = (pa: number, pa30: number) => pa < 0.7 || pa30 - pa > 0.25;

/**
 * Week by week through the disruption: how many customers the model would flag "slipping away",
 * once reading calendar time (naive) and once reading business time (aware).
 */
export function alarms(win: [number, number], keep: number, activity: number): AlarmSeries {
  const all = customers();
  const hit = disrupt(all, win, keep);
  const params = fitMBG(all.map((c) => rfm(c, win[0])).filter((x): x is NonNullable<typeof x> => !!x));
  const count = (cs: Customer[], t: number, tw = t, w30 = t - 30 * DAY) =>
    cs.reduce((n, c) => {
      const r = rfm(c, tw), r30 = rfm(c, w30);
      if (!r || r.T < 30) return n;
      return n + (atRisk(pAlive(params, r), r30 ? pAlive(params, r30) : 1) ? 1 : 0);
    }, 0);
  const warped = warpAll(hit, win, activity);
  const weeks = [];
  for (let t = win[0] - 2 * WEEK; t <= TODAY; t += WEEK) {
    weeks.push({
      label: new Date(t).toUTCString().slice(5, 11),
      t,
      baseline: count(all, t),
      naive: count(hit, t),
      aware: count(warped, t, warp(t, win, activity), warp(t - 30 * DAY, win, activity)),
    });
  }
  const peakNaive = Math.max(...weeks.map((w) => w.naive - w.baseline));
  const peakAware = Math.max(...weeks.map((w) => w.aware - w.baseline));
  return { weeks, peakNaive, peakAware, falseAlarmsAvoided: Math.max(0, peakNaive - peakAware) };
}

export interface ResilienceReport {
  local: Classification;
  citywide: Classification;
  outage: Classification;
  lockdownAlarms: AlarmSeries;
  outageAlarms: AlarmSeries;
}

let cache: ResilienceReport | null = null;
export function resilience(): ResilienceReport {
  if (cache) return cache;
  const local = classify(network().merchants);
  const citywide = classify(lockdownNetwork());
  const outage = { ...classify(outageNetwork()), activity: 0 };
  cache = {
    local,
    citywide,
    outage,
    // Shop activity during the lockdown follows the city index Paytm measured for kiranas.
    lockdownAlarms: alarms(LOCKDOWN, 0.3, Math.max(0.15, citywide.activity)),
    // During an outage payments still happen; they just aren't seen until the device reconnects.
    outageAlarms: alarms(OUTAGE, 0, 0),
  };
  return cache;
}
