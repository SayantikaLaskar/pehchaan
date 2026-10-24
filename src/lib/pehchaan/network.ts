// Paytm's view across many merchants. When regulars drop off at several kiranas in the
// same week, and the drop is steepest around one point, something new opened there.
import { DARK_STORE, DAY, TODAY, rng } from "./sim";
import { analyse } from "./model";

export interface Merchant {
  id: string;
  name: string;
  cat: string;
  x: number;
  y: number;
  weekly: number[]; // active-regulars index per week
  drop: number; // last 4 weeks vs the 12 before
  z: number;
  flagged: boolean;
  onsetWeek: number | null;
  self?: boolean;
}

export const WEEK0 = Date.UTC(2026, 4, 4); // 12+ weeks of baseline before the opening
export const WEEKS = Math.floor((TODAY - WEEK0) / (7 * DAY));

const NAMES = [
  ["Balaji Provisions", "Kirana"], ["Sri Lakshmi Stores", "Kirana"], ["Fresh Mart HSR", "Grocery"], ["Annapoorna Dairy", "Dairy"],
  ["Ganesh Fruits", "Fruits"], ["Nandini Milk Parlour", "Dairy"], ["Venkateshwara Veg", "Vegetables"], ["Royal Bakery", "Bakery"],
  ["Om Sai Kirana", "Kirana"], ["Green Leaf Organics", "Grocery"], ["Mahalakshmi Provisions", "Kirana"], ["Hari Om Supermarket", "Grocery"],
  ["Kumar Stores", "Kirana"], ["Sri Durga Veg & Fruits", "Vegetables"], ["Daily Needs 24x7", "Grocery"], ["Shanthi Sagar Bakery", "Bakery"],
  ["Manasa Provisions", "Kirana"], ["Classic Dairy", "Dairy"], ["New Bharath Stores", "Kirana"], ["Sai Ram Fruits", "Fruits"],
  ["Basava Kirana", "Kirana"], ["Namma Angadi", "Kirana"], ["Ayyappa Stores", "Kirana"], ["Lotus Supermart", "Grocery"],
  ["Sree Krishna Veg", "Vegetables"], ["Coffee Day Kiosk", "Café"], ["Bharat Medicals", "Pharmacy"], ["Raghavendra Stores", "Kirana"],
  ["Prakash Provisions", "Kirana"], ["Swagath Dairy", "Dairy"], ["Shree Balaji Fruits", "Fruits"], ["Amma Mess", "Food"],
  ["Anand Stationery", "Stationery"], ["Vasavi Kirana", "Kirana"], ["Tirumala Veg", "Vegetables"],
];

export interface Network {
  merchants: Merchant[];
  inferred: { x: number; y: number; errorM: number; onset: string; decayM: number };
  flaggedCount: number;
  firstAlert: string;
}

let cache: Network | null = null;

const label = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
};
export const weekLabel = (i: number) => label(WEEK0 + i * 7 * DAY);

export function network(): Network {
  if (cache) return cache;
  const r = rng(7);
  const openWeek = (DARK_STORE.opens - WEEK0) / (7 * DAY);
  const ms: Merchant[] = NAMES.map(([name, cat], i) => {
    const ang = r() * Math.PI * 2, dist = 200 + r() * 1900;
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
    const d = Math.hypot(x - DARK_STORE.x, y - DARK_STORE.y);
    // Groceries and dairy lose more to quick commerce than pharmacies and cafés.
    const sens = { Kirana: 1, Grocery: 1.1, Dairy: 0.9, Vegetables: 0.8, Fruits: 0.8, Bakery: 0.5, Café: 0.15, Pharmacy: 0.2, Food: 0.2, Stationery: 0.3 }[cat] ?? 0.5;
    const impact = 0.36 * Math.exp(-d / 650) * sens;
    const weekly = Array.from({ length: WEEKS }, (_, w) => {
      const ramp = w < openWeek ? 0 : Math.min(1, (w - openWeek + 0.5) / 5);
      return 100 * (1 - impact * ramp) * (1 + (r() - 0.5) * 0.07);
    });
    return { id: `M${i}`, name, cat, x, y, weekly, drop: 0, z: 0, flagged: false, onsetWeek: null };
  });

  // Our own shop, from its real customer visits.
  const { scored } = analyse();
  const self = Array.from({ length: WEEKS }, (_, w) => {
    const a = WEEK0 + w * 7 * DAY;
    return scored.reduce((s, x) => s + x.c.visits.filter((v) => v.t >= a && v.t < a + 7 * DAY).length, 0);
  });
  const base = self.slice(0, 12).reduce((s, v) => s + v, 0) / 12;
  ms.unshift({ id: "SELF", name: "Sri Manjunatha Stores", cat: "Kirana", x: 0, y: 0, weekly: self.map((v) => (v / base) * 100), drop: 0, z: 0, flagged: false, onsetWeek: null, self: true });

  // Detection: last 4 weeks against a 12-week baseline, plus a CUSUM change point.
  for (const m of ms) {
    const baseW = m.weekly.slice(0, 12), recent = m.weekly.slice(-4);
    const mu = baseW.reduce((s, v) => s + v, 0) / baseW.length;
    const sd = Math.sqrt(baseW.reduce((s, v) => s + (v - mu) ** 2, 0) / baseW.length) || 1;
    const rec = recent.reduce((s, v) => s + v, 0) / recent.length;
    m.drop = (rec - mu) / mu;
    m.z = (rec - mu) / sd;
    m.flagged = m.drop < -0.07 && m.z < -2.5;
    let cus = 0;
    for (let w = 12; w < m.weekly.length; w++) {
      cus = Math.min(0, cus + (m.weekly[w] - mu) / sd + 0.5);
      if (cus < -4) { m.onsetWeek = w; break; }
    }
  }

  // Triangulate: find the point and radius that best explain each merchant's drop.
  // (Our own shop's index comes from raw visits on a different scale, so it isn't used here.)
  const peers = ms.filter((m) => !m.self);
  let best = { x: 0, y: 0, L: 600, err: Infinity, A: 0 };
  for (let gx = -2200; gx <= 2200; gx += 40)
    for (let gy = -2200; gy <= 2200; gy += 40)
      for (const L of [400, 550, 700, 900]) {
        const f = peers.map((m) => Math.exp(-Math.hypot(m.x - gx, m.y - gy) / L));
        const y = peers.map((m) => -m.drop);
        const A = f.reduce((s, v, i) => s + v * y[i], 0) / f.reduce((s, v) => s + v * v, 0);
        const err = f.reduce((s, v, i) => s + (A * v - y[i]) ** 2, 0);
        if (err < best.err) best = { x: gx, y: gy, L, err, A };
      }
  const onsets = ms.filter((m) => m.flagged && m.onsetWeek != null).map((m) => m.onsetWeek!).sort((a, b) => a - b);
  const first = onsets[0] ?? 0;
  cache = {
    merchants: ms,
    inferred: { x: best.x, y: best.y, errorM: Math.hypot(best.x - DARK_STORE.x, best.y - DARK_STORE.y), onset: weekLabel(onsets[Math.floor(onsets.length / 2)] ?? 0), decayM: best.L },
    flaggedCount: ms.filter((m) => m.flagged).length,
    firstAlert: weekLabel(first),
  };
  return cache;
}
