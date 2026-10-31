// Turns a merchant's payment export (CSV) into customers the models can score.
// Runs entirely in the browser: the file never leaves the device.
import { DAY, type Customer } from "./sim";
import { backtest, scoreAll } from "./model";

export type Role = "date" | "time" | "amount" | "name" | "vpa" | "status";
export type Mapping = Partial<Record<Role, number>>;

export const ROLE_LABEL: Record<Role, string> = {
  date: "Date", time: "Time (optional)", amount: "Amount", name: "Payer name", vpa: "Payer UPI ID", status: "Status (optional)",
};

const HINTS: Record<Role, RegExp> = {
  date: /date|txn.?date|transaction.?date|created/i,
  time: /^time$|txn.?time|transaction.?time/i,
  amount: /amount|amt|value|inr|₹/i,
  name: /payer.?name|customer.?name|sender|name/i,
  vpa: /vpa|upi.?id|payer.?(id|address)|handle/i,
  status: /status|state|result/i,
};

/** RFC 4180-ish CSV: quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function detect(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  for (const role of ["vpa", "name", "date", "time", "amount", "status"] as Role[]) {
    const i = headers.findIndex((h, j) => !used.has(j) && HINTS[role].test(h));
    if (i >= 0) { m[role] = i; used.add(i); }
  }
  return m;
}

const MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/** Accepts 2026-10-24, 24-10-2026, 24/10/2026, 24 Oct 2026, with or without a time. Day-first, as Indian exports are. */
export function parseDate(s: string): number | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  m = t.match(/^(\d{1,2})[ -]([A-Za-z]{3,4})[a-z]*[ -,]*(\d{4})/);
  if (m && MON[m[2].toLowerCase()] != null) return Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1]);
  return null;
}

export const parseAmount = (s: string) => {
  const n = parseFloat(s.replace(/[₹,\s]|INR|Rs\.?/gi, ""));
  return Number.isFinite(n) ? n : null;
};

export interface Imported {
  customers: Customer[];
  payments: number;
  skipped: number;
  from: number;
  to: number;
}

export function build(rows: string[][], map: Mapping): Imported {
  const byKey = new Map<string, { name: string; vpa: string; days: Map<number, number> }>();
  let payments = 0, skipped = 0, from = Infinity, to = -Infinity;
  for (const r of rows) {
    const t = map.date != null ? parseDate(r[map.date] ?? "") : null;
    const amt = map.amount != null ? parseAmount(r[map.amount] ?? "") : null;
    const ok = map.status == null || /success|complete|settled|paid|credit/i.test(r[map.status] ?? "");
    const name = map.name != null ? r[map.name] : "";
    const vpa = map.vpa != null ? r[map.vpa] : "";
    if (t == null || amt == null || amt <= 0 || !ok || !(name || vpa)) { skipped++; continue; }
    const key = (vpa || name).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { name: name || vpa.split("@")[0], vpa: vpa || "—", days: new Map() });
    const c = byKey.get(key)!;
    c.days.set(t, (c.days.get(t) ?? 0) + amt); // same-day payments are one visit
    payments++;
    from = Math.min(from, t);
    to = Math.max(to, t);
  }
  const customers: Customer[] = [...byKey.values()].map((c, i) => {
    const visits = [...c.days.entries()].sort((a, b) => a[0] - b[0]).map(([t, amount]) => ({ t, amount }));
    return {
      id: `U${String(i).padStart(4, "0")}`, name: c.name, vpa: c.vpa, household: `UH${i}`, archetype: "regular",
      x: 0, y: 0, joined: visits[0].t, affected: false, switchedAt: null, visits,
    };
  });
  return { customers, payments, skipped, from, to };
}

/** Score an import as of its last day; backtest on the final 60 days when there's enough history. */
export function analyseImport(data: Imported) {
  const today = data.to;
  const span = (data.to - data.from) / DAY;
  const result = scoreAll(data.customers, today);
  const bt = span >= 150 ? backtest(data.customers, today - 60 * DAY, today) : null;
  return { ...result, backtest: bt, today, span };
}

/** A Paytm-for-Business-style export of the demo shop, so anyone can try the importer. */
export function sampleExport(all: Customer[], rnd: () => number): string {
  const head = ["Transaction Date", "Transaction Time", "Order ID", "Payer Name", "Payer VPA", "Amount (INR)", "Status", "Payment Mode"];
  const lines = [head.join(",")];
  let n = 0;
  for (const c of all)
    for (const v of c.visits) {
      const parts = rnd() < 0.12 ? 2 : 1; // some visits are two payments on the same day
      for (let k = 0; k < parts; k++) {
        const d = new Date(v.t);
        const date = `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
        const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes() + k).padStart(2, "0")}:00`;
        const status = rnd() < 0.02 ? "FAILED" : "SUCCESS";
        lines.push([date, time, `PTM${(1_000_000 + n++).toString(36).toUpperCase()}`, `"${c.name}"`, c.vpa, (v.amount / parts).toFixed(2), status, "UPI"].join(","));
      }
    }
  return lines.join("\n");
}
