import { FY_CURR, FY_PREV, TODAY, type Cls, type Purchase, type Txn } from "./data";
import { monthShort } from "./format";

// Section 22 CGST Act — registration threshold for suppliers of goods in Karnataka.
export const THRESHOLD = 40_00_000;
// Composition scheme for traders: 1% (0.5% CGST + 0.5% SGST) on taxable supplies.
export const COMPOSITION_RATE = 0.01;
// Approximate gross margins used to turn purchase mix into sales mix.
const MARGIN = { produce: 1.25, packaged: 1.12 };

export type Answers = Record<string, Exclude<Cls, "review">>;
type FY = typeof FY_PREV;

export const CLS_META: Record<Cls, { label: string; short: string; tone: string }> = {
  sale: { label: "Business sales", short: "Sale", tone: "var(--c-sale)" },
  personal: { label: "Family & friends", short: "Personal", tone: "var(--c-personal)" },
  loan: { label: "Loan disbursals", short: "Loan", tone: "var(--c-loan)" },
  own: { label: "Own money", short: "Own", tone: "var(--c-own)" },
  refund: { label: "Refunds & reversals", short: "Refund", tone: "var(--c-refund)" },
  review: { label: "Needs review", short: "Review", tone: "var(--c-review)" },
};

export function resolved(t: Txn, a: Answers): Cls {
  return a[t.id] ?? t.cls;
}

const inFY = (d: string, fy: FY) => d >= iso(fy.start) && d <= iso(fy.end);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function salesMix(purchases: Purchase[], fy: FY) {
  let produce = 0, packaged = 0, n = 0;
  for (const p of purchases) {
    if (!inFY(p.date, fy)) continue;
    n++;
    if (p.kind === "produce") produce += p.amount;
    else packaged += p.amount;
  }
  const exemptShare = (produce * MARGIN.produce) / (produce * MARGIN.produce + packaged * MARGIN.packaged);
  return { produce, packaged, n, exemptShare };
}

export function summarize(txns: Txn[], purchases: Purchase[], fy: FY, answers: Answers) {
  const by: Record<Cls, number> = { sale: 0, personal: 0, loan: 0, own: 0, refund: 0, review: 0 };
  const counts: Record<Cls, number> = { sale: 0, personal: 0, loan: 0, own: 0, refund: 0, review: 0 };
  let gross = 0, payments = 0;
  for (const t of txns) {
    if (!inFY(t.date, fy)) continue;
    const c = resolved(t, answers);
    by[c] += t.amount;
    counts[c] += t.count ?? 1;
    gross += t.amount;
    payments += t.count ?? 1;
  }
  // Unanswered items are counted as sales — conservative, never understates tax.
  const business = by.sale + by.review;
  const mix = salesMix(purchases, fy);
  const exempt = business * mix.exemptShare;
  const taxable = business - exempt;
  return {
    fy,
    gross,
    payments,
    by,
    counts,
    business,
    exempt,
    taxable,
    mix,
    nonBusiness: gross - business,
    belowThreshold: business < THRESHOLD,
    compositionTax: taxable * COMPOSITION_RATE,
  };
}

export function monthly(txns: Txn[], fy: FY, answers: Answers) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(fy.start.getUTCFullYear(), fy.start.getUTCMonth() + i, 1));
    return { key: iso(d).slice(0, 7), label: monthShort(d.getUTCMonth()), business: 0, other: 0 };
  });
  for (const t of txns) {
    if (!inFY(t.date, fy)) continue;
    const m = months.find((x) => x.key === t.date.slice(0, 7));
    if (!m) continue;
    const c = resolved(t, answers);
    if (c === "sale" || c === "review") m.business += t.amount;
    else m.other += t.amount;
  }
  return months;
}

// Projects the current FY by scaling last year's remaining months by this year's growth.
export function forecast(txns: Txn[], answers: Answers) {
  const prev = monthly(txns, FY_PREV, answers);
  const curr = monthly(txns, FY_CURR, answers);
  const todayKey = iso(TODAY).slice(0, 7);
  const idx = curr.findIndex((m) => m.key === todayKey);
  const dayFrac = TODAY.getUTCDate() / new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + 1, 0)).getUTCDate();

  const prevYtd = prev.slice(0, idx).reduce((a, m) => a + m.business, 0) + prev[idx].business * dayFrac;
  const currYtd = curr.slice(0, idx + 1).reduce((a, m) => a + m.business, 0);
  const growth = currYtd / prevYtd;

  let running = 0;
  let crossing: string | null = null;
  const series = curr.map((m, i) => {
    const projected = i < idx ? m.business : i === idx ? m.business + prev[i].business * (1 - dayFrac) * growth : prev[i].business * growth;
    running += projected;
    if (!crossing && running >= THRESHOLD) crossing = m.label + " " + m.key.slice(0, 4);
    return { ...m, projected, actual: i <= idx ? m.business : 0, cumulative: running, isFuture: i > idx, isNow: i === idx };
  });
  return { series, ytd: currYtd, projectedTotal: running, growth, crossing: crossing as string | null, nowIndex: idx };
}

export const inr = (n: number, opts: { compact?: boolean } = {}) => {
  if (opts.compact) {
    if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
    if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  }
  return "₹" + Math.round(n).toLocaleString("en-IN");
};
