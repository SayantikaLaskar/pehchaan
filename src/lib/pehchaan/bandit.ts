// Which offer brings regulars back most profitably? A Beta-Bernoulli bandit over offer sizes,
// chosen by Thompson sampling. Starts from earlier campaigns at this shop (simulated history)
// and updates with every resolved offer — including redemptions from customers' phones.
import { gamma, rng } from "./sim";

export const ARMS = [20, 30, 50] as const;
export type Arm = (typeof ARMS)[number];

// Earlier campaigns: [redeemed, not redeemed] per offer size (simulated history).
export const HISTORY: Record<Arm, [number, number]> = { 20: [7, 41], 30: [16, 38], 50: [19, 33] };

export interface ArmState { arm: Arm; s: number; f: number; mean: number; lo: number; hi: number; profit: number }

function betaSample(r: () => number, a: number, b: number) {
  const x = gamma(r, a, 1), y = gamma(r, b, 1);
  return x / (x + y);
}

/** Posterior per arm from history + live outcomes, with a 90% interval and expected profit per offer sent. */
export function arms(outcomes: { offer: number; returned: boolean }[], valueIfBack: number): ArmState[] {
  return ARMS.map((arm) => {
    const live = outcomes.filter((o) => o.offer === arm);
    const s = 1 + HISTORY[arm][0] + live.filter((o) => o.returned).length;
    const f = 1 + HISTORY[arm][1] + live.filter((o) => !o.returned).length;
    const r = rng(arm * 31 + s * 7 + f);
    const draws = Array.from({ length: 2000 }, () => betaSample(r, s, f)).sort((a, b) => a - b);
    const mean = s / (s + f);
    return { arm, s, f, mean, lo: draws[100], hi: draws[1899], profit: mean * (valueIfBack - arm) };
  });
}

/** Thompson sampling: draw once from each posterior of expected profit and pick the best. Seeded so a week's choice is stable. */
export function pick(states: ArmState[], valueIfBack: number, seed: number): Arm {
  const r = rng(seed);
  let best = states[0].arm, bestV = -Infinity;
  for (const st of states) {
    const v = betaSample(r, st.s, st.f) * (valueIfBack - st.arm);
    if (v > bestV) { bestV = v; best = st.arm; }
  }
  return best;
}

/** Beta density for the posterior chart. */
export function betaPdf(x: number, a: number, b: number) {
  const lg = (z: number) => {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = z, t = z + 5.5;
    t -= (z + 0.5) * Math.log(t);
    let s = 1.000000000190015;
    for (const k of c) s += k / ++y;
    return -t + Math.log((2.5066282746310005 * s) / z);
  };
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + lg(a + b) - lg(a) - lg(b));
}
