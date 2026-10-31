"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, CloudOff, KeyRound, Lock, PackageOpen, QrCode, RefreshCw, ScanLine, Send, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { QrScan, QrStream } from "@/components/QrRelay";
import { flush, items as queuedItems, prune, type Queued } from "@/lib/outbox";
import { acceptReceipt, bundle, deviceFingerprint, ensureRelay, identity, receipts, serverPub, type StoredReceipt } from "@/lib/relay/client";
import { toFrames, type Receipt } from "@/lib/relay/crypto";
import s from "./relay.module.css";

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`; };

function describe(q: Queued) {
  const b = (() => { try { return JSON.parse(q.body); } catch { return {}; } })();
  const m = q.url.match(/^\/api\/offers\/(.+)$/);
  if (m) return b.action === "redeem" ? `Offer ${m[1]} redeemed` : b.action === "optout" ? `Customer stopped offers (${m[1]})` : `Offer ${m[1]} opened`;
  if (q.url === "/api/offers") return `${b.items?.length ?? 0} win-back offers sent`;
  if (q.url === "/api/whatsapp/simulate") return `WhatsApp order from ${b.name ?? "a customer"}`;
  return q.url;
}

// The shop's side of Pehchaan Relay: everything waiting for a network, and a way to hand it to any visiting phone.
export default function Relay() {
  const [q, setQ] = useState<Queued[]>([]);
  const [rc, setRc] = useState<StoredReceipt[]>([]);
  const [fp, setFp] = useState<string | null>(null);
  const [ready, setReady] = useState({ id: false, key: false, reg: false });
  const [online, setOnline] = useState(true);
  const [frames, setFrames] = useState<string[] | null>(null);
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => {
    setQ(queuedItems()); setRc(receipts()); setOnline(navigator.onLine);
    const me = identity();
    setReady({ id: !!me, key: !!serverPub(), reg: !!me?.registered });
    deviceFingerprint().then(setFp);
  }, []);

  useEffect(() => {
    ensureRelay().then(refresh);
    // "storage" catches actions queued in another tab, e.g. the Soundbox screen at the counter.
    const evs = ["pehchaan-outbox", "pehchaan-relay", "online", "offline", "storage", "focus"];
    evs.forEach((e) => window.addEventListener(e, refresh));
    return () => evs.forEach((e) => window.removeEventListener(e, refresh));
  }, [refresh]);

  const handOff = async () => {
    const env = await bundle(queuedItems());
    if (!env) { setMsg(ready.key ? "Nothing waiting to send." : "Open this page once with network so the device can learn Paytm's key."); return; }
    setFrames(toFrames("B", JSON.stringify(env)));
    setMsg("");
  };

  const gotReceipt = async (payload: string) => {
    setScan(false);
    try {
      const ids = await acceptReceipt(JSON.parse(payload) as Receipt, "carrier");
      if (!ids.length) { setMsg("That receipt isn't signed by Paytm for this device — ignored."); return; }
      prune(ids); setFrames(null);
      setMsg(`Receipt verified — ${ids.length} action${ids.length > 1 ? "s" : ""} confirmed delivered by a visiting phone.`);
    } catch { setMsg("Couldn't read that receipt."); }
  };

  const bytes = frames ? frames.reduce((a, f) => a + f.length, 0) : 0;

  return (
    <div className={s.page}>
      <section className={`card ${s.hero}`} data-in>
        <div>
          <span className="badge badge-info"><PackageOpen />Pehchaan Relay · store, carry, forward</span>
          <h2>No tower at the shop? Any phone that visits carries the data out.</h2>
          <p>Actions taken offline — redemptions, consent changes, orders — wait here. A distributor&apos;s salesman, a delivery rider or a customer scans the relay code; their phone delivers it the next time <b>it</b> has signal. They can&apos;t read it (sealed to Paytm) or change it (signed by this device), and Paytm applies each action once, with its real time.</p>
        </div>
        <ol className={s.flow}>
          <li><Lock size={16} /><span><b>Seal</b>AES-256-GCM to Paytm&apos;s key · ECDSA-signed by this device</span></li>
          <li><QrCode size={16} /><span><b>Hand off</b>animated QR — no pairing, no network, any phone</span></li>
          <li><Smartphone size={16} /><span><b>Carry</b>stored on the visitor&apos;s phone until it finds signal</span></li>
          <li><ShieldCheck size={16} /><span><b>Deliver + receipt</b>verified, de-duplicated, signed receipt back</span></li>
        </ol>
      </section>

      <section className={s.kpis}>
        <div className="card" data-in><span className={s.kL}>This device</span><b className="mono">{fp ?? "…"}</b><small>{ready.reg ? "registered with Paytm" : ready.id ? "registers next time it's online" : "creating key…"}</small></div>
        <div className="card" data-in><span className={s.kL}>Network</span><b className={online ? s.good : s.warn}>{online ? "Online" : "No signal"}</b><small>{online ? "queue syncs directly" : "hand off to a visiting phone"}</small></div>
        <div className="card" data-in><span className={s.kL}>Waiting to leave</span><b className="mono">{q.length}</b><small>actions, oldest {q[0] ? ago(q[0].t) : "—"}</small></div>
        <div className="card" data-in><span className={s.kL}>Confirmed by Paytm</span><b className={`mono ${s.good}`}>{rc.reduce((a, r) => a + r.ids.length, 0)}</b><small>{rc.filter((r) => r.by === "carrier").length} receipts carried back by phones</small></div>
      </section>

      <div className={s.grid}>
        <section className="card" data-in>
          <div className="card-head"><div><div className="card-title">Waiting for a network</div><div className="card-sub">Queued on this device — they leave by whichever route appears first</div></div>
            <div className={s.btns}>
              <button className="btn btn-secondary btn-sm" disabled={!online || !q.length} onClick={() => flush().then(refresh)}><Send size={13} />Send now</button>
              <button className="btn btn-primary btn-sm" disabled={!q.length} onClick={handOff}><QrCode size={13} />Hand to a visiting phone</button>
            </div>
          </div>
          <ul className={s.queue}>
            {q.length === 0 && <li className={s.empty}><CheckCheck size={15} />Nothing waiting. Go offline (DevTools → Network → Offline, or airplane mode) and redeem an offer on the Soundbox screen to see it queue here.</li>}
            {q.map((x) => <li key={x.id}><span>{describe(x)}</span><small className="mono">{ago(x.t)} · {x.id.slice(0, 8)}</small></li>)}
          </ul>
          {msg && <p className={s.msg}>{msg}</p>}
        </section>

        <aside className={`card ${s.hand}`} data-in>
          {frames ? (
            <>
              <div className={s.handHead}><b>Scan with a visiting phone</b><small>{frames.length} frames · {Math.round(bytes / 102.4) / 10} KB sealed · open <span className="mono">/relay</span> on the phone</small></div>
              <QrStream frames={frames} size={300} />
              <p className={s.handNote}>The phone shows a receipt after it delivers. Scan it here next visit — or this device picks it up itself when it gets signal.</p>
              {scan ? <QrScan kind="R" onDone={gotReceipt} /> : <button className="btn btn-secondary btn-sm" onClick={() => setScan(true)}><ScanLine size={13} />Scan a receipt from the phone</button>}
            </>
          ) : (
            <div className={s.idle}>
              <KeyRound size={22} />
              <b>Ready to hand off</b>
              <p>Press <b>Hand to a visiting phone</b>. The phone opens <span className="mono">pehchaan-sigma.vercel.app/relay</span> once with signal (in production: inside the Paytm app) and scans.</p>
              <ul>
                <li>{ready.key ? <CheckCheck size={13} /> : <CloudOff size={13} />}Paytm&apos;s public key {ready.key ? "cached" : "needed once while online"}</li>
                <li>{ready.reg ? <CheckCheck size={13} /> : <RefreshCw size={13} />}Device {ready.reg ? "registered" : "not registered yet"}</li>
                <li>{online ? <Wifi size={13} /> : <CloudOff size={13} />}{online ? "Online now" : "Offline — relay is the way out"}</li>
              </ul>
            </div>
          )}
        </aside>
      </div>

      {rc.length > 0 && (
        <section className="card" data-in>
          <div className="card-head"><div className="card-title">Receipts from Paytm</div><span className="card-sub">each signed with Paytm&apos;s key and verified on this device</span></div>
          <ul className={s.queue}>{rc.map((r) => <li key={r.n + r.at}><span>{r.ids.length} action{r.ids.length > 1 ? "s" : ""} confirmed · bundle <span className="mono">{r.n}</span></span><small>{r.by === "carrier" ? "carried back by a visiting phone" : "picked up over the network"} · {ago(r.at)}</small></li>)}</ul>
        </section>
      )}
    </div>
  );
}
