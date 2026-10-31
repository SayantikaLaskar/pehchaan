// Tiny key-value + event log for the live offer loop. Uses Upstash Redis (REST) when its
// env vars are present (Vercel Marketplace sets them); otherwise process memory, which is
// fine locally but not shared across serverless instances.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const durable = Boolean(URL_ && TOKEN);

type Mem = { kv: Map<string, string>; events: string[] };
const g = globalThis as unknown as { __pehchaanStore?: Mem };
const mem: Mem = (g.__pehchaanStore ??= { kv: new Map(), events: [] });

async function redis<T>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const WEEK = 7 * 24 * 3600;

export async function put(key: string, value: unknown) {
  const v = JSON.stringify(value);
  if (durable) await redis(["SET", key, v, "EX", WEEK]);
  else mem.kv.set(key, v);
}

export async function get<T>(key: string): Promise<T | null> {
  const v = durable ? await redis<string | null>(["GET", key]) : mem.kv.get(key) ?? null;
  return v ? (JSON.parse(v) as T) : null;
}

export interface OfferEvent { t: number; type: "redeemed" | "optout"; code: string; id: string }

export async function pushEvent(e: OfferEvent) {
  const v = JSON.stringify(e);
  if (durable) { await redis(["LPUSH", "events", v]); await redis(["LTRIM", "events", 0, 499]); }
  else { mem.events.unshift(v); mem.events.length = Math.min(mem.events.length, 500); }
}

export async function events(since: number): Promise<OfferEvent[]> {
  const raw = durable ? await redis<string[]>(["LRANGE", "events", 0, 99]) : mem.events.slice(0, 100);
  return raw.map((r) => JSON.parse(r) as OfferEvent).filter((e) => e.t > since).reverse();
}
