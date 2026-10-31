"use client";
// Offline-first writes. A kirana's 4G drops, the phone is in a basement, the Soundbox SIM loses
// signal: actions are kept on the device and leave by whichever route appears first —
//   • the shop's own connection, when it comes back, or
//   • any visiting phone that carries a sealed bundle out (Pehchaan Relay, see lib/relay).
// Each action has an id, the server applies it once, and the device forgets it only on a signed receipt.
import type { Item, Receipt } from "./relay/crypto";
import { acceptReceipt, bundle, ensureRelay, pullReceipts } from "./relay/client";

const KEY = "pehchaan.outbox.v1";
export type Queued = Item;

const read = (): Queued[] => {
  try { return (JSON.parse(localStorage.getItem(KEY) || "[]") as Partial<Queued>[]).map((q) => ({ id: q.id ?? crypto.randomUUID(), url: q.url!, body: q.body!, t: q.t ?? Date.now() })); } catch { return []; }
};
const write = (q: Queued[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
  window.dispatchEvent(new CustomEvent("pehchaan-outbox", { detail: q.length }));
};

export const queued = () => read().length;
export const items = () => read();

/** Forget actions Paytm has confirmed (from a receipt, however it arrived). */
export function prune(ids: string[]) {
  if (!ids.length) return;
  const done = new Set(ids);
  write(read().filter((q) => !done.has(q.id)));
}

const enqueue = (url: string, payload: string) => write([...read(), { id: crypto.randomUUID(), url, body: payload, t: Date.now() }]);

/** POST now if we can; otherwise queue it and resolve null. Server errors are not retried. */
export async function post(url: string, body: unknown): Promise<Response | null> {
  const payload = JSON.stringify(body);
  if (typeof navigator !== "undefined" && !navigator.onLine) { enqueue(url, payload); return null; }
  try {
    return await fetch(url, { method: "POST", body: payload });
  } catch {
    enqueue(url, payload);
    return null;
  }
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  try {
    prune(await pullReceipts()); // a visiting phone may already have delivered some of these
    const q = read();
    if (!q.length) return 0;
    // Preferred: one sealed bundle through the relay (applied once, with original times, receipted).
    const env = await bundle(q);
    if (env) {
      const r = await fetch("/api/relay/bundle", { method: "POST", body: JSON.stringify({ envelope: env, carrier: "direct" }) }).catch(() => null);
      if (r?.ok) { prune(await acceptReceipt(((await r.json()) as { receipt: Receipt }).receipt, "network")); return q.length; }
      if (r && r.status !== 404) return 0; // 404: device not registered yet — fall through to plain requests
    }
    let sent = 0;
    for (const item of q) {
      try { await fetch(item.url, { method: "POST", body: item.body }); } catch { break; }
      prune([item.id]); sent++;
    }
    return sent;
  } finally { flushing = false; }
}

/** Register the relay identity, then replay on reconnect and every 15 s while anything is waiting. */
export function startOutbox({ shop = true } = {}) {
  // Only the shop's device has a relay identity; a customer's phone just replays its own requests.
  const on = () => { (shop ? ensureRelay() : Promise.resolve()).then(() => flush()); };
  window.addEventListener("online", on);
  const id = setInterval(() => { if (read().length) flush(); }, 15000);
  on();
  return () => { window.removeEventListener("online", on); clearInterval(id); };
}
