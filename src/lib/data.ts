// Deterministic synthetic UPI history for one Bengaluru merchant.
// Same seed → same numbers on every machine, so the demo never drifts.

export type Cls = "sale" | "personal" | "loan" | "own" | "refund" | "review";

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  payer: string;
  vpa: string;
  note: string;
  count?: number; // for aggregated QR collections
  truth: Exclude<Cls, "review">; // what the merchant would answer
  cls: Cls; // what Kavach decided
  confidence: number;
  reason: string;
}

export interface Purchase {
  id: string;
  date: string;
  amount: number;
  payee: string;
  kind: "produce" | "packaged";
}

export const MERCHANT = {
  name: "Manjunath Gowda",
  shop: "Sri Manjunatha Vegetables & Provisions",
  area: "HSR Layout, Bengaluru",
  vpa: "manjunathveg@paytm",
  since: "2019",
  lang: "kn-IN" as const,
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

// Apr → Mar multipliers (Dasara/Deepavali bump in Oct–Nov, Ugadi in Mar)
const SEASON = [0.95, 0.94, 0.9, 0.9, 0.95, 1.0, 1.22, 1.16, 1.0, 0.95, 0.94, 1.09];

export const FY_PREV = { label: "FY 2025–26", start: day(2025, 3, 1), end: day(2026, 2, 31) };
export const FY_CURR = { label: "FY 2026–27", start: day(2026, 3, 1), end: day(2027, 2, 31) };
export const TODAY = day(2026, 9, 24);

const SALES_TARGET_PREV = 36_20_000;
const GROWTH = 1.15;

function buildSales(r: () => number): Txn[] {
  const out: Txn[] = [];
  const seasonSum = SEASON.reduce((a, b) => a + b, 0);
  const fy = (start: Date, end: Date, target: number) => {
    const rows: Txn[] = [];
    for (let d = new Date(start); d <= end && d <= TODAY; d.setUTCDate(d.getUTCDate() + 1)) {
      const mIdx = (d.getUTCMonth() + 9) % 12; // Apr = 0
      const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const base = (target * SEASON[mIdx]) / seasonSum / daysInMonth;
      const sunday = d.getUTCDay() === 0 ? 1.18 : 1;
      const amt = base * sunday * (0.82 + r() * 0.36);
      rows.push({
        id: `S${iso(d)}`,
        date: iso(d),
        amount: amt,
        payer: "QR collections",
        vpa: "multiple payers",
        note: "Counter sales via Paytm QR",
        count: Math.round(amt / (190 + r() * 70)),
        truth: "sale",
        cls: "sale",
        confidence: 0.99,
        reason: "",
      });
    }
    return rows;
  };
  const prev = fy(FY_PREV.start, FY_PREV.end, SALES_TARGET_PREV);
  const sum = prev.reduce((a, t) => a + t.amount, 0);
  prev.forEach((t) => (t.amount = Math.round((t.amount * SALES_TARGET_PREV) / sum)));
  const curr = fy(FY_CURR.start, FY_CURR.end, SALES_TARGET_PREV * GROWTH);
  curr.forEach((t) => (t.amount = Math.round(t.amount)));
  out.push(...prev, ...curr);
  return out;
}

type Seed = Omit<Txn, "id" | "cls" | "confidence" | "reason">;

function buildOther(): Seed[] {
  const s: Seed[] = [];
  const months = (y0: number, m0: number, n: number) =>
    Array.from({ length: n }, (_, i) => day(y0 + Math.floor((m0 + i) / 12), (m0 + i) % 12, 1));

  // Brother in Dubai — monthly inward remittance
  months(2025, 3, 19).forEach((d) => {
    const dt = new Date(d);
    dt.setUTCDate(5);
    if (dt <= TODAY)
      s.push({ date: iso(dt), amount: 40_000, payer: "RAVI GOWDA", vpa: "IMPS/INWARD REMIT/AE", note: "Family maintenance", truth: "personal" });
  });
  // Wife's salary share
  [
    ["2025-05-12", 25_000], ["2025-08-14", 30_000], ["2025-11-10", 35_000], ["2026-02-11", 40_000],
    ["2026-05-13", 30_000], ["2026-08-12", 35_000],
  ].forEach(([d, a]) =>
    s.push({ date: d as string, amount: a as number, payer: "KAVYA GOWDA", vpa: "kavya.gowda@okhdfc", note: "for house", truth: "personal" }),
  );
  // Loans
  s.push({ date: "2025-06-18", amount: 3_00_000, payer: "MUTHOOT FINANCE LTD", vpa: "NEFT/MUTH0000041", note: "GOLD LOAN DISB 4471", truth: "loan" });
  s.push({ date: "2025-12-02", amount: 2_00_000, payer: "BAJAJ FINANCE LTD", vpa: "NEFT/BAJA0000112", note: "PL DISB 88231", truth: "loan" });
  s.push({ date: "2026-07-21", amount: 1_50_000, payer: "MUTHOOT FINANCE LTD", vpa: "NEFT/MUTH0000041", note: "GOLD LOAN DISB 5102", truth: "loan" });
  // Own money moving in
  [
    ["2025-04-22", 50_000], ["2025-07-08", 40_000], ["2025-09-29", 60_000], ["2025-10-15", 45_000],
    ["2025-12-20", 30_000], ["2026-01-28", 35_000], ["2026-03-09", 60_000], ["2026-06-04", 50_000],
    ["2026-09-26", 70_000],
  ].forEach(([d, a]) =>
    s.push({ date: d as string, amount: a as number, payer: "MANJUNATH GOWDA", vpa: "SBIN/xx2231", note: "self transfer", truth: "own" }),
  );
  s.push({ date: "2026-01-16", amount: 1_25_000, payer: "SRI VINAYAKA CHITS", vpa: "NEFT/KARB0000318", note: "CHIT PRIZE AMT GRP 14", truth: "own" });
  // Supplier refunds and reversals
  const r = rng(77);
  for (let i = 0; i < 24; i++) {
    const d = new Date(FY_PREV.start.getTime() + r() * (TODAY.getTime() - FY_PREV.start.getTime()));
    s.push({
      date: iso(d),
      amount: Math.round(1200 + r() * 3800),
      payer: r() > 0.5 ? "SRI LAKSHMI AGENCIES" : "PAYTM REFUND",
      vpa: r() > 0.5 ? "REV/UPI/FAILED" : "lakshmiagencies@ybl",
      note: r() > 0.5 ? "REFUND short supply" : "REVERSAL txn failed",
      truth: "refund",
    });
  }
  // Ambiguous — Kavach asks the merchant
  s.push({ date: "2025-10-30", amount: 42_000, payer: "SRI RAMA TEMPLE TRUST", vpa: "sriramatemple@sbi", note: "deepotsava order", truth: "sale" });
  s.push({ date: "2026-02-19", amount: 18_500, payer: "LAKSHMI CATERERS", vpa: "9845xxxx21@paytm", note: "", truth: "sale" });
  s.push({ date: "2025-08-23", amount: 20_000, payer: "RAMESH K", vpa: "rameshk88@oksbi", note: "", truth: "personal" });
  s.push({ date: "2026-04-11", amount: 15_000, payer: "SURESH N", vpa: "9900xxxx12@ybl", note: "returning", truth: "personal" });
  s.push({ date: "2026-10-03", amount: 36_000, payer: "GREEN BOWL CAFE", vpa: "greenbowl@icici", note: "weekly veg", truth: "sale" });
  s.push({ date: "2026-08-30", amount: 25_000, payer: "PRAKASH M", vpa: "prakashm@okaxis", note: "", truth: "personal" });
  return s;
}

function buildPurchases(r: () => number): Purchase[] {
  const out: Purchase[] = [];
  for (let d = new Date(FY_PREV.start); d <= TODAY; d.setUTCDate(d.getUTCDate() + 1)) {
    if (r() < 0.86)
      out.push({ id: `P${iso(d)}a`, date: iso(d), amount: Math.round(6200 + r() * 3200), payee: "KR MARKET / APMC YESHWANTHPUR", kind: "produce" });
    if (d.getUTCDay() === 2 || d.getUTCDay() === 5)
      out.push({ id: `P${iso(d)}b`, date: iso(d), amount: Math.round(5200 + r() * 3600), payee: "SRI LAKSHMI AGENCIES (FMCG)", kind: "packaged" });
  }
  return out;
}

let cache: { txns: Txn[]; purchases: Purchase[] } | null = null;

import { classify } from "./classify";

export function getData() {
  if (cache) return cache;
  const r = rng(2026);
  const sales = buildSales(r);
  const others = buildOther().map((o, i) => ({ ...o, id: `T${i.toString().padStart(3, "0")}`, ...classify(o) }));
  const txns = [...sales, ...others].sort((a, b) => (a.date < b.date ? 1 : -1));
  cache = { txns, purchases: buildPurchases(r) };
  return cache;
}
