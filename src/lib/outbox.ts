"use client";
// Offline-first writes. A kirana's 4G drops, the phone is in a basement, the Soundbox SIM loses
// signal: actions are kept on the device and replayed in order when the network returns.
const KEY = "pehchaan.outbox.v1";
export interface Queued { url: string; body: string; t: number }

const read = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (q: Queued[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
  window.dispatchEvent(new CustomEvent("pehchaan-outbox", { detail: q.length }));
};

export const queued = () => read().length;

/** POST now if we can; otherwise queue it and resolve null. Server errors are not retried. */
export async function post(url: string, body: unknown): Promise<Response | null> {
  const payload = JSON.stringify(body);
  if (typeof navigator !== "undefined" && !navigator.onLine) { write([...read(), { url, body: payload, t: Date.now() }]); return null; }
  try {
    return await fetch(url, { method: "POST", body: payload });
  } catch {
    write([...read(), { url, body: payload, t: Date.now() }]);
    return null;
  }
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    let q = read();
    while (q.length) {
      try { await fetch(q[0].url, { method: "POST", body: q[0].body }); } catch { break; }
      q = q.slice(1); write(q); sent++;
    }
  } finally { flushing = false; }
  return sent;
}

/** Replay on reconnect and every 15 s while anything is waiting. */
export function startOutbox() {
  const on = () => { flush(); };
  window.addEventListener("online", on);
  const id = setInterval(() => { if (read().length) flush(); }, 15000);
  flush();
  return () => { window.removeEventListener("online", on); clearInterval(id); };
}
