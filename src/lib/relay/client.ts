"use client";
// The shop device's relay identity and the carrier's pocket. Keys live on the device; the private
// signing key never leaves it. (A production app would keep it non-extractable in the Android
// Keystore / IndexedDB; localStorage keeps this prototype simple and inspectable.)
import { fingerprint, makeEnvelope, newSigningKeys, receiptText, verify, type Envelope, type Item, type Receipt } from "./crypto";

const ID_KEY = "pehchaan.relay.device.v1";
const SRV_KEY = "pehchaan.relay.server.v1";
const RCPT_KEY = "pehchaan.relay.receipts.v1";
const CARRY_KEY = "pehchaan.relay.carry.v1";

interface Identity { id: string; priv: JsonWebKey; pub: JsonWebKey; registered: boolean }
interface ServerPub { seal: JsonWebKey; sig: JsonWebKey }

const read = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const changed = () => window.dispatchEvent(new Event("pehchaan-relay"));

export const identity = () => read<Identity>(ID_KEY);
export const serverPub = () => read<ServerPub>(SRV_KEY);

/** Create the device key once; while online, fetch Paytm's public keys and register. Safe to call often. */
export async function ensureRelay(shop = "Sri Manjunatha Stores") {
  let me = identity();
  if (!me) {
    const k = await newSigningKeys();
    me = { id: "dev-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16), ...k, registered: false };
    write(ID_KEY, me);
  }
  if (!navigator.onLine) return me;
  try {
    if (!serverPub()) write(SRV_KEY, await fetch("/api/relay/key").then((r) => r.json()));
    if (!me.registered) {
      const r = await fetch("/api/relay/register", { method: "POST", body: JSON.stringify({ id: me.id, pub: me.pub, shop }) });
      if (r.ok) { me = { ...me, registered: true }; write(ID_KEY, me); }
    }
  } catch {}
  changed();
  return me;
}

export async function deviceFingerprint() {
  const me = identity();
  return me ? fingerprint(me.pub) : null;
}

/** Seal a set of queued actions into one bundle a carrier can hold. Needs the server key cached once. */
export async function bundle(items: Item[]): Promise<Envelope | null> {
  const me = identity(), srv = serverPub();
  if (!me || !srv || !items.length) return null;
  return makeEnvelope(me.id, me.priv, srv.seal, items);
}

/* ───────────── receipts: proof Paytm got it, so the shop can forget it ───────────── */

export interface StoredReceipt extends Receipt { by: string }
export const receipts = () => read<StoredReceipt[]>(RCPT_KEY) ?? [];

/** Verify against Paytm's key; returns the ids it covers (empty if forged or for another device). */
export async function acceptReceipt(r: Receipt, by: string): Promise<string[]> {
  const me = identity(), srv = serverPub();
  if (!me || !srv || r.d !== me.id) return [];
  if (!(await verify(srv.sig, receiptText(r), r.g))) return [];
  const list = receipts();
  if (!list.some((x) => x.n === r.n && x.at === r.at)) write(RCPT_KEY, [{ ...r, by }, ...list].slice(0, 50));
  changed();
  return r.ids;
}

export async function pullReceipts(): Promise<string[]> {
  const me = identity();
  if (!me || !navigator.onLine) return [];
  try {
    const { receipts: rs } = (await fetch(`/api/relay/receipts?d=${me.id}`).then((r) => r.json())) as { receipts: Receipt[] };
    const ids: string[] = [];
    for (const r of rs) ids.push(...(await acceptReceipt(r, "network")));
    return ids;
  } catch { return []; }
}

/* ───────────── the carrier's side ───────────── */

export interface Carried { env: Envelope; got: number; status: "carrying" | "delivered" | "rejected"; receipt?: Receipt; result?: { applied: number; duplicate: number; delayMs: number; error?: string } }
export const carried = () => read<Carried[]>(CARRY_KEY) ?? [];

export function pickUp(env: Envelope) {
  const list = carried();
  if (list.some((x) => x.env.n === env.n)) return false;
  write(CARRY_KEY, [{ env, got: Date.now(), status: "carrying" }, ...list].slice(0, 20));
  changed();
  return true;
}

/** Deliver everything this phone is carrying. Runs on reconnect and on demand. */
export async function deliverAll() {
  if (!navigator.onLine) return 0;
  const list = carried();
  let n = 0;
  for (const c of list) {
    if (c.status !== "carrying") continue;
    try {
      const r = await fetch("/api/relay/bundle", { method: "POST", body: JSON.stringify({ envelope: c.env, carrier: "qr" }) });
      const j = await r.json();
      if (r.ok) { c.status = "delivered"; c.receipt = j.receipt; c.result = { applied: j.applied, duplicate: j.duplicate, delayMs: j.delayMs }; n++; }
      else if (r.status === 400 || r.status === 404) { c.status = "rejected"; c.result = { applied: 0, duplicate: 0, delayMs: 0, error: j.error }; }
    } catch { break; }
  }
  write(CARRY_KEY, list);
  changed();
  return n;
}
