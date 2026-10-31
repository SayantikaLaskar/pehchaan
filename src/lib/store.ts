// Tiny key-value + event log for the live offer loop.
// Backend, in order: MongoDB (MONGODB_URI) → Upstash Redis REST (UPSTASH_/KV_ env) → process memory.
// Memory works locally but is not shared across serverless instances.
import { MongoClient, type Collection } from "mongodb";

const MONGO = process.env.MONGODB_URI;
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const backend: "mongodb" | "upstash" | "memory" = MONGO ? "mongodb" : URL_ && TOKEN ? "upstash" : "memory";
export const durable = backend !== "memory";

export interface OfferEvent {
  t: number;
  type: "opened" | "redeemed" | "optout" | "order" | "relay";
  code: string;
  id: string;
  // WhatsApp orders only
  from?: string; // customer's WhatsApp number (masked before it reaches the browser)
  name?: string;
  text?: string;
  via?: string; // "cloud-api" | "simulator" | "relay:qr" | "relay:direct"
  at?: number; // when it happened, if it arrived late (offline relay)
  // relay deliveries only
  items?: number;
  carrier?: string;
}

const WEEK = 7 * 24 * 3600;

/* ───────────── memory ───────────── */
type Mem = { kv: Map<string, string>; events: string[] };
const g = globalThis as unknown as { __pehchaanStore?: Mem; __pehchaanMongo?: Promise<MongoClient> };
const mem: Mem = (g.__pehchaanStore ??= { kv: new Map(), events: [] });

/* ───────────── MongoDB ───────────── */
// One client per serverless instance, reused across invocations.
async function col<T extends object>(name: "offers" | "events"): Promise<Collection<T>> {
  g.__pehchaanMongo ??= new MongoClient(MONGO!, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).connect().then(async (c) => {
    const db = c.db(process.env.MONGODB_DB || "pehchaan");
    // Offers expire after a week; events are capped by query (latest 100).
    await db.collection("offers").createIndex({ at: 1 }, { expireAfterSeconds: WEEK }).catch(() => {});
    await db.collection("events").createIndex({ t: -1 }).catch(() => {});
    return c;
  });
  const client = await g.__pehchaanMongo;
  return client.db(process.env.MONGODB_DB || "pehchaan").collection<T>(name);
}

/* ───────────── Upstash ───────────── */
async function redis<T>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

/* ───────────── API ───────────── */
export async function put(key: string, value: unknown) {
  if (backend === "mongodb") {
    const c = await col<{ _id: string; v: unknown; at: Date }>("offers");
    await c.updateOne({ _id: key }, { $set: { v: value, at: new Date() } }, { upsert: true });
  } else if (backend === "upstash") await redis(["SET", key, JSON.stringify(value), "EX", WEEK]);
  else mem.kv.set(key, JSON.stringify(value));
}

export async function get<T>(key: string): Promise<T | null> {
  if (backend === "mongodb") {
    const c = await col<{ _id: string; v: T }>("offers");
    return (await c.findOne({ _id: key }))?.v ?? null;
  }
  const v = backend === "upstash" ? await redis<string | null>(["GET", key]) : mem.kv.get(key) ?? null;
  return v ? (JSON.parse(v) as T) : null;
}

export async function pushEvent(e: OfferEvent) {
  if (backend === "mongodb") await (await col<OfferEvent>("events")).insertOne({ ...e });
  else if (backend === "upstash") { await redis(["LPUSH", "events", JSON.stringify(e)]); await redis(["LTRIM", "events", 0, 499]); }
  else { mem.events.unshift(JSON.stringify(e)); mem.events.length = Math.min(mem.events.length, 500); }
}

export async function events(since: number): Promise<OfferEvent[]> {
  if (backend === "mongodb") {
    const rows = await (await col<OfferEvent>("events")).find({ t: { $gt: since } }, { projection: { _id: 0 } }).sort({ t: -1 }).limit(100).toArray();
    return rows.reverse();
  }
  const raw = backend === "upstash" ? await redis<string[]>(["LRANGE", "events", 0, 99]) : mem.events.slice(0, 100);
  return raw.map((r) => JSON.parse(r) as OfferEvent).filter((e) => e.t > since).reverse();
}
