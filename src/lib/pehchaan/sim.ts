// Deterministic synthetic UPI history: one HSR Layout kirana, its customers, and a
// quick-commerce dark store that opens nearby partway through. Same seed → same story.

export const DAY = 86_400_000;
export const START = Date.UTC(2025, 10, 1); // 1 Nov 2025
export const TODAY = Date.UTC(2026, 9, 25); // 25 Oct 2026
export const DARK_STORE = { opens: Date.UTC(2026, 7, 18), x: 640, y: -380, label: "Quick-commerce dark store" };

export const SHOP = {
  name: "Sri Manjunatha Vegetables & Provisions",
  short: "Sri Manjunatha Stores",
  owner: "Manjunath Gowda",
  area: "HSR Layout Sector 2, Bengaluru",
  vpa: "manjunathveg@paytm",
};

export type Archetype = "daily" | "regular" | "weekly" | "occasional";

export interface Customer {
  id: string;
  name: string;
  vpa: string;
  household: string;
  archetype: Archetype;
  x: number; // metres from the shop
  y: number;
  joined: number;
  affected: boolean; // switched to quick commerce (ground truth, hidden from the model)
  switchedAt: number | null;
  visits: Visit[];
}

export interface Visit { t: number; amount: number }

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Marsaglia–Tsang gamma sampler
export function gamma(r: () => number, shape: number, scale: number): number {
  if (shape < 1) return gamma(r, shape + 1, scale) * Math.pow(r(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      const u1 = r(), u2 = r();
      x = Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

const FIRST = [
  "Ramesh", "Suresh", "Lakshmi", "Kavya", "Priya", "Anil", "Deepa", "Vinay", "Shwetha", "Arjun", "Meera", "Rahul", "Divya", "Karthik",
  "Sneha", "Naveen", "Pooja", "Harish", "Ananya", "Rohit", "Bhavana", "Manoj", "Asha", "Vikram", "Nikhil", "Rekha", "Sanjay", "Aisha",
  "Farhan", "Neha", "Gautam", "Shilpa", "Kiran", "Swati", "Pradeep", "Jyothi", "Abhishek", "Ritu", "Mohan", "Sowmya", "Imran", "Varun",
];
const LAST = [
  "Sharma", "Rao", "Reddy", "Gowda", "Iyer", "Nair", "Shetty", "Kulkarni", "Hegde", "Patil", "Menon", "Gupta", "Verma", "Khan", "Joshi",
  "Bhat", "Naidu", "Pillai", "Das", "Agarwal", "Kamath", "Prasad", "Murthy", "Singh",
];

const ARCH: Record<Archetype, { share: number; rate: number; spend: number; drop: number }> = {
  daily: { share: 0.12, rate: 0.5, spend: 170, drop: 0.004 },
  regular: { share: 0.28, rate: 0.22, spend: 310, drop: 0.012 },
  weekly: { share: 0.3, rate: 0.12, spend: 540, drop: 0.02 },
  occasional: { share: 0.3, rate: 0.035, spend: 260, drop: 0.06 },
};

const N = 420;

let cache: Customer[] | null = null;

export function customers(): Customer[] {
  if (cache) return cache;
  const r = rng(31);
  const out: Customer[] = [];
  const names = new Set<string>();
  for (let i = 0; i < N; i++) {
    let name = "";
    do name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; while (names.has(name));
    names.add(name);

    const u = r();
    let acc = 0;
    let archetype: Archetype = "occasional";
    for (const [k, v] of Object.entries(ARCH) as [Archetype, (typeof ARCH)[Archetype]][]) {
      acc += v.share;
      if (u < acc) { archetype = k; break; }
    }
    const a = ARCH[archetype];

    // Customers cluster near the shop; most live within ~1 km.
    const dist = Math.min(1600, gamma(r, 2, 260));
    const ang = r() * Math.PI * 2;
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;

    // 70% were already customers on day one; the rest arrive through the year.
    const joined = r() < 0.7 ? START : START + Math.floor(r() * (TODAY - START - 30 * DAY));
    const rate = gamma(r, 4, a.rate / 4);
    const pDrop = Math.min(0.25, gamma(r, 1.5, a.drop / 1.5));
    const spend = a.spend * (0.6 + r() * 0.9);

    // Dark-store effect: closer households with frequent small baskets switch first.
    const dDark = Math.hypot(x - DARK_STORE.x, y - DARK_STORE.y);
    const exposure = Math.exp(-dDark / 700) * (archetype === "occasional" ? 0.5 : 1);
    const affected = r() < exposure * 0.85;
    const switchedAt = affected ? DARK_STORE.opens + Math.floor(gamma(r, 2, 9) * DAY) : null;

    const visits: Visit[] = [];
    let t = joined + Math.floor(r() * 3) * DAY;
    let alive = true;
    let hit = false; // still a customer when the dark store reached them
    while (alive && t <= TODAY) {
      if (switchedAt && t >= switchedAt) hit = true;
      const date = new Date(t);
      const hour = r() < 0.55 ? 7 + Math.floor(r() * 4) : 17 + Math.floor(r() * 4);
      visits.push({ t: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, Math.floor(r() * 60)), amount: Math.round(spend * (0.55 + r() * 0.9)) });
      if (r() < pDrop) alive = false;
      const effRate = switchedAt && t >= switchedAt ? rate * (r() < 0.5 ? 0.08 : 0.25) : rate;
      t += Math.max(1, Math.round(-Math.log(r() || 1e-9) / effRate)) * DAY;
    }

    out.push({
      id: `C${String(i).padStart(3, "0")}`,
      name,
      vpa: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1][0].toLowerCase()}${Math.floor(r() * 90 + 10)}@ok${["sbi", "axis", "hdfc", "icici"][Math.floor(r() * 4)]}`,
      household: `H${i}`,
      archetype,
      x, y,
      joined,
      affected: hit,
      switchedAt,
      visits,
    });
  }
  // Households: same surname living within 120 m share a household id.
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (a.name.split(" ")[1] === b.name.split(" ")[1] && Math.hypot(a.x - b.x, a.y - b.y) < 120) b.household = a.household;
    }
  cache = out.filter((c) => c.visits.length > 0);
  return cache;
}
