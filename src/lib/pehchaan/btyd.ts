// "Buy 'Til You Die" models for non-contractual customers.
//   BG/NBD — Fader, Hardie & Lee (2005), "Counting Your Customers the Easy Way"
//   Gamma-Gamma — Fader, Hardie & Lee (2005), "RFM and CLV"
// A kirana regular never cancels; they just stop coming. These models estimate, from
// frequency (x), recency (t_x) and age (T), the probability a customer is still active.

export interface RFM { x: number; tx: number; T: number; mx: number } // repeat visits, last-visit age, customer age (days), mean spend

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < 8; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function nelderMead(f: (p: number[]) => number, x0: number[], iters = 2500): number[] {
  const n = x0.length;
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + 0.5 : v)))].map((p) => ({ p, v: f(p) }));
  for (let k = 0; k < iters; k++) {
    simplex.sort((a, b) => a.v - b.v);
    const best = simplex[0], worst = simplex[n], second = simplex[n - 1];
    if (Math.abs(worst.v - best.v) < 1e-10) break;
    const c = Array.from({ length: n }, (_, j) => simplex.slice(0, n).reduce((s, q) => s + q.p[j], 0) / n);
    const at = (t: number) => c.map((cj, j) => cj + t * (worst.p[j] - cj));
    const r = at(-1), fr = f(r);
    if (fr < best.v) {
      const e = at(-2), fe = f(e);
      simplex[n] = fe < fr ? { p: e, v: fe } : { p: r, v: fr };
    } else if (fr < second.v) simplex[n] = { p: r, v: fr };
    else {
      const ct = at(fr < worst.v ? -0.5 : 0.5), fc = f(ct);
      if (fc < Math.min(fr, worst.v)) simplex[n] = { p: ct, v: fc };
      else simplex = simplex.map((q, i) => (i === 0 ? q : { p: q.p.map((v, j) => best.p[j] + 0.5 * (v - best.p[j])), v: 0 })).map((q, i) => (i === 0 ? q : { ...q, v: f(q.p) }));
    }
  }
  simplex.sort((a, b) => a.v - b.v);
  return simplex[0].p;
}

/* ───────────── BG/NBD ───────────── */

export interface BGParams { r: number; alpha: number; a: number; b: number }

function bgLL({ r, alpha, a, b }: BGParams, c: RFM) {
  const { x, tx, T } = c;
  const A1 = lnGamma(r + x) - lnGamma(r) + r * Math.log(alpha);
  const A2 = lnGamma(a + b) + lnGamma(b + x) - lnGamma(b) - lnGamma(a + b + x);
  const A3 = -(r + x) * Math.log(alpha + T);
  if (x === 0) return A1 + A2 + A3;
  const A4 = Math.log(a) - Math.log(b + x - 1) - (r + x) * Math.log(alpha + tx);
  const m = Math.max(A3, A4);
  return A1 + A2 + m + Math.log(Math.exp(A3 - m) + Math.exp(A4 - m));
}

export function fitBG(data: RFM[]): BGParams {
  const unpack = (p: number[]): BGParams => ({ r: Math.exp(p[0]), alpha: Math.exp(p[1]), a: Math.exp(p[2]), b: Math.exp(p[3]) });
  const nll = (p: number[]) => {
    const q = unpack(p);
    let s = 0;
    for (const c of data) s += bgLL(q, c);
    // tiny ridge keeps the optimiser out of degenerate corners
    return -s + 1e-3 * p.reduce((a, v) => a + v * v, 0);
  };
  return unpack(nelderMead(nll, [0, 1, 0, 1]));
}

export function pAlive({ r, alpha, a, b }: BGParams, { x, tx, T }: RFM) {
  if (x === 0) return 1;
  return 1 / (1 + (a / (b + x - 1)) * Math.pow((alpha + T) / (alpha + tx), r + x));
}

function hyp2f1(a: number, b: number, c: number, z: number) {
  let term = 1, sum = 1;
  for (let n = 0; n < 2000; n++) {
    term *= ((a + n) * (b + n)) / ((c + n) * (n + 1)) * z;
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return sum;
}

/** Expected number of visits in the next `t` days. */
export function expectedVisits({ r, alpha, a, b }: BGParams, { x, tx, T }: RFM, t: number) {
  const z = t / (alpha + T + t);
  const hyp = hyp2f1(r + x, b + x, a + b + x - 1, z);
  const num = ((a + b + x - 1) / (a - 1)) * (1 - Math.pow((alpha + T) / (alpha + T + t), r + x) * hyp);
  const den = 1 + (x > 0 ? (a / (b + x - 1)) * Math.pow((alpha + T) / (alpha + tx), r + x) : 0);
  return num / den;
}

/* ───────────── Gamma-Gamma spend ───────────── */

export interface GGParams { p: number; q: number; v: number }

export function fitGG(data: RFM[]): GGParams {
  const rows = data.filter((c) => c.x > 0);
  const unpack = (k: number[]): GGParams => ({ p: Math.exp(k[0]), q: Math.exp(k[1]), v: Math.exp(k[2]) });
  const nll = (k: number[]) => {
    const { p, q, v } = unpack(k);
    let s = 0;
    for (const { x, mx } of rows)
      s += lnGamma(p * x + q) - lnGamma(p * x) - lnGamma(q) + q * Math.log(v) + (p * x - 1) * Math.log(mx) + p * x * Math.log(x) - (p * x + q) * Math.log(v + x * mx);
    return -s + 1e-3 * k.reduce((a, b) => a + b * b, 0);
  };
  return unpack(nelderMead(nll, [1, 1, 3]));
}

export function expectedSpend({ p, q, v }: GGParams, { x, mx }: RFM) {
  if (x === 0) return (p * v) / (q - 1);
  return ((v + mx * x) * p) / (p * x + q - 1);
}


/* ───────────── MBG/NBD ─────────────
   Batislam, Denizel & Filiztekin (2007). Like BG/NBD, but a customer can also drop out right
   after their first purchase — so one-visit customers aren't assumed to be alive forever. */

function mbgLL({ r, alpha, a, b }: BGParams, c: RFM) {
  const { x, tx, T } = c;
  const A1 = lnGamma(r + x) - lnGamma(r) + r * Math.log(alpha);
  const A2 = lnGamma(a + b) + lnGamma(b + x + 1) - lnGamma(b) - lnGamma(a + b + x + 1);
  const A3 = -(r + x) * Math.log(alpha + T);
  const A4 = Math.log(a) - Math.log(b + x) - (r + x) * Math.log(alpha + tx);
  const m = Math.max(A3, A4);
  return A1 + A2 + m + Math.log(Math.exp(A3 - m) + Math.exp(A4 - m));
}

export function fitMBG(data: RFM[]): BGParams {
  const unpack = (p: number[]): BGParams => ({ r: Math.exp(p[0]), alpha: Math.exp(p[1]), a: Math.exp(p[2]), b: Math.exp(p[3]) });
  const nll = (p: number[]) => {
    const q = unpack(p);
    let s = 0;
    for (const c of data) s += mbgLL(q, c);
    return -s + 1e-3 * p.reduce((a, v) => a + v * v, 0);
  };
  return unpack(nelderMead(nll, [0, 1, 0, 1]));
}

export function pAliveMBG({ r, alpha, a, b }: BGParams, { x, tx, T }: RFM) {
  return 1 / (1 + (a / (b + x)) * Math.pow((alpha + T) / (alpha + tx), r + x));
}

export function expectedVisitsMBG({ r, alpha, a, b }: BGParams, { x, tx, T }: RFM, t: number) {
  const z = t / (alpha + T + t);
  const hyp = hyp2f1(r + x, b + x + 1, a + b + x, z);
  const num = ((a + b + x) / (a - 1)) * (1 - Math.pow((alpha + T) / (alpha + T + t), r + x) * hyp);
  const den = 1 + (a / (b + x)) * Math.pow((alpha + T) / (alpha + tx), r + x);
  return num / den;
}

/** Log-likelihood of a fitted model, for comparing BG/NBD and MBG/NBD on the same data. */
export function totalLL(kind: "bg" | "mbg", p: BGParams, data: RFM[]) {
  let s = 0;
  for (const c of data) s += kind === "bg" ? bgLL(p, c) : mbgLL(p, c);
  return s;
}
