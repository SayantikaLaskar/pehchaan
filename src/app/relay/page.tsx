"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, CloudOff, Lock, PackageCheck, ScanLine, Send, Smartphone, Wifi } from "lucide-react";
import { Logo } from "@/components/Logo";
import { QrScan, QrStream } from "@/components/QrRelay";
import { carried, deliverAll, pickUp, type Carried } from "@/lib/relay/client";
import { toFrames, type Envelope } from "@/lib/relay/crypto";
import s from "./carrier.module.css";

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`; };
const hours = (ms: number) => (ms < 3600e3 ? `${Math.max(1, Math.round(ms / 60000))} min` : `${(ms / 3600e3).toFixed(1)} h`);

// The visiting phone. Anyone can carry: a distributor's salesman, a delivery rider, a customer heading
// to town. In production this lives inside the Paytm app; here it's a page that works offline once loaded.
export default function Carrier() {
  const [list, setList] = useState<Carried[]>([]);
  const [scan, setScan] = useState(false);
  const [online, setOnline] = useState(true);
  const [show, setShow] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => { setList(carried()); setOnline(navigator.onLine); }, []);
  useEffect(() => {
    refresh();
    const go = () => { refresh(); deliverAll().then(refresh); };
    const evs = ["pehchaan-relay", "offline"];
    evs.forEach((e) => window.addEventListener(e, refresh));
    window.addEventListener("online", go);
    const id = setInterval(() => { if (navigator.onLine && carried().some((c) => c.status === "carrying")) deliverAll().then(refresh); }, 10000);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { evs.forEach((e) => window.removeEventListener(e, refresh)); window.removeEventListener("online", go); clearInterval(id); };
  }, [refresh]);

  const got = async (payload: string) => {
    setScan(false);
    try {
      const env = JSON.parse(payload) as Envelope;
      if (env.v !== 1 || !env.g) throw new Error();
      setMsg(pickUp(env) ? "Picked up. It's sealed — you can't read it, and nobody can change it." : "You're already carrying this one.");
      refresh();
      if (navigator.onLine) { await deliverAll(); refresh(); }
    } catch { setMsg("That isn't a Pehchaan relay code."); }
  };

  const carrying = list.filter((c) => c.status === "carrying");
  return (
    <main className={s.screen}>
      <header className={s.top}><Logo size={22} /><b>Pehchaan Relay</b><span className={online ? s.on : s.off}>{online ? <Wifi size={13} /> : <CloudOff size={13} />}{online ? "Online" : "No signal"}</span></header>

      <section className={s.hero}>
        <h1>Carry a shop&apos;s data out of a no-signal zone.</h1>
        <p>Scan the code on the shop&apos;s screen. Your phone keeps a sealed bundle and delivers it to Paytm the next time you have signal — automatically.</p>
        <div className={s.facts}><span><Lock size={13} />Sealed: you can&apos;t read it</span><span><CheckCheck size={13} />Signed: nobody can change it</span><span><Smartphone size={13} />No pairing, no app install</span></div>
      </section>

      {scan ? (
        <section className={s.card}><QrScan kind="B" onDone={got} /><button className={s.ghost} onClick={() => setScan(false)}>Cancel</button></section>
      ) : (
        <button className={s.primary} onClick={() => { setMsg(""); setScan(true); }}><ScanLine size={18} />Scan the shop&apos;s relay code</button>
      )}
      {msg && <p className={s.msg}>{msg}</p>}

      {carrying.length > 0 && (
        <section className={s.card}>
          <b className={s.h}>Carrying {carrying.length} bundle{carrying.length > 1 ? "s" : ""}</b>
          {carrying.map((c) => <div key={c.env.n} className={s.row}><span><b className="mono">{c.env.n}</b><small>picked up {ago(c.got)} · {(JSON.stringify(c.env).length / 1024).toFixed(1)} KB sealed</small></span><span className={s.wait}>{online ? "delivering…" : "waiting for signal"}</span></div>)}
          <button className={s.secondary} disabled={!online} onClick={() => deliverAll().then(refresh)}><Send size={15} />Deliver now</button>
        </section>
      )}

      {list.some((c) => c.status !== "carrying") && (
        <section className={s.card}>
          <b className={s.h}>Delivered</b>
          {list.filter((c) => c.status !== "carrying").map((c) => (
            <div key={c.env.n} className={s.row}>
              <span>
                <b>{c.status === "delivered" ? <><PackageCheck size={14} /> {c.result?.applied} new action{c.result?.applied === 1 ? "" : "s"}{c.result?.duplicate ? ` · ${c.result.duplicate} already there` : ""}</> : "Rejected"}</b>
                <small>{c.status === "delivered" ? `reached Paytm ${hours(c.result?.delayMs ?? 0)} after it happened` : c.result?.error}</small>
              </span>
              {c.receipt && <button className={s.link} onClick={() => setShow(show === c.env.n ? null : c.env.n)}>{show === c.env.n ? "Hide" : "Receipt"}</button>}
            </div>
          ))}
          {show && (() => { const c = list.find((x) => x.env.n === show); return c?.receipt ? <div className={s.rcpt}><QrStream frames={toFrames("R", JSON.stringify(c.receipt))} size={220} /><small>Next visit, show this to the shop so it can forget what Paytm already has. (It also finds out by itself once it gets signal.)</small></div> : null; })()}
        </section>
      )}

      <footer className={s.foot}>In production this is a button inside the Paytm app, and the hand-off also runs over Bluetooth / Wi-Fi Direct (Nearby Connections) — same sealed bundle.</footer>
    </main>
  );
}
