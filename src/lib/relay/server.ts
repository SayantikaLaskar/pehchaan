// Paytm's end of the relay: holds the sealing key, knows each shop device's public key, and accepts
// bundles from anyone carrying them. Every action is applied exactly once, with its original time.
import { get, pushEvent, put } from "@/lib/store";
import { offerAction, simulatedOrder, createOffers, type NewOffer, type OfferAction } from "@/lib/offers";
import { newSealingKeys, newSigningKeys, openEnvelope, receiptText, sign, type Envelope, type Item, type Receipt } from "./crypto";

interface ServerKeys { seal: { priv: JsonWebKey; pub: JsonWebKey }; sig: { priv: JsonWebKey; pub: JsonWebKey } }
interface Device { id: string; pub: JsonWebKey; shop: string; registeredAt: number }

let keys: Promise<ServerKeys> | null = null;
/** From RELAY_SERVER_KEYS (JSON) if set, else generated once and kept in the store. */
export function serverKeys(): Promise<ServerKeys> {
  return (keys ??= (async () => {
    if (process.env.RELAY_SERVER_KEYS) return JSON.parse(process.env.RELAY_SERVER_KEYS) as ServerKeys;
    const have = await get<ServerKeys>("relay:server");
    if (have) return have;
    const made = { seal: await newSealingKeys(), sig: await newSigningKeys() };
    await put("relay:server", made);
    return (await get<ServerKeys>("relay:server")) ?? made; // another instance may have won the race
  })().catch((e) => { keys = null; throw e; }));
}

export async function publicKeys() {
  const k = await serverKeys();
  return { seal: k.seal.pub, sig: k.sig.pub };
}

/**
 * Trust on first use for the prototype. In production the device key is bound to the merchant when the
 * Soundbox or the Paytm for Business app is provisioned, so a stranger can't register a shop.
 */
export async function register(id: string, pub: JsonWebKey, shop: string) {
  const have = await get<Device>(`relay:dev:${id}`);
  if (have && (have.pub.x !== pub.x || have.pub.y !== pub.y)) return { ok: false as const, error: "device id already bound to another key" };
  if (!have) await put(`relay:dev:${id}`, { id, pub, shop, registeredAt: Date.now() } satisfies Device);
  return { ok: true as const };
}

// Only these actions may travel by relay — each maps to the same function its HTTP route uses.
async function apply(item: Item, via: string) {
  const body = JSON.parse(item.body);
  let m = item.url.match(/^\/api\/offers\/([A-Za-z0-9_-]{6})$/);
  if (m) return void (await offerAction(m[1], body.action as OfferAction, body.offer ?? null, item.t, via));
  if (item.url === "/api/offers") return void (await createOffers(body.items as NewOffer[], item.t));
  m = item.url.match(/^\/api\/whatsapp\/simulate$/);
  if (m) return void (await simulatedOrder(body.id, body.name, body.text, item.t));
  throw new Error(`not relayable: ${item.url}`);
}

export async function receive(env: Envelope, carrier: "direct" | "qr" | string) {
  const dev = await get<Device>(`relay:dev:${env.d}`);
  if (!dev) return { ok: false as const, status: 404, error: "unknown device — it must register once while online" };
  const k = await serverKeys();
  let items: Item[];
  try {
    items = await openEnvelope(env, dev.pub, k.seal.priv);
  } catch {
    return { ok: false as const, status: 400, error: "bundle failed its signature or could not be opened" };
  }
  const applied: string[] = [], skipped: string[] = [], failed: string[] = [];
  for (const it of items) {
    if (await get(`relay:item:${it.id}`)) { skipped.push(it.id); continue; } // delivered before, by another carrier
    try {
      await apply(it, `relay:${carrier}`);
      await put(`relay:item:${it.id}`, { at: Date.now(), n: env.n });
      applied.push(it.id);
    } catch {
      failed.push(it.id);
    }
  }
  const oldest = Math.min(...items.map((i) => i.t), env.t);
  if (applied.length) await pushEvent({ t: Date.now(), type: "relay", code: env.n, id: env.d, items: applied.length, carrier, at: oldest, name: dev.shop });
  // Receipt covers everything the shop can now forget: applied now or applied earlier.
  const body = { d: env.d, n: env.n, ids: [...applied, ...skipped], at: Date.now() };
  const receipt: Receipt = { ...body, g: await sign(k.sig.priv, receiptText(body)) };
  const list = (await get<Receipt[]>(`relay:rcpt:${env.d}`)) ?? [];
  await put(`relay:rcpt:${env.d}`, [receipt, ...list].slice(0, 30));
  return { ok: true as const, receipt, applied: applied.length, duplicate: skipped.length, failed: failed.length, delayMs: Date.now() - oldest };
}

export async function receipts(deviceId: string) {
  return (await get<Receipt[]>(`relay:rcpt:${deviceId}`)) ?? [];
}
