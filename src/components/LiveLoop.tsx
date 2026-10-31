"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BellOff, Smartphone } from "lucide-react";
import { useApp } from "./Providers";
import { lines } from "@/lib/pehchaan/i18n";
import { WinMoment, type Win } from "./WinMoment";
import { usePehchaan } from "@/lib/pehchaan/use";

interface LoopEvent { t: number; type: "opened" | "redeemed" | "optout" | "order"; code: string; id: string }

// Listens for customers acting on their phones and reflects it on the dashboard and the Soundbox.
export function LiveLoop() {
  const { sent, seen, setSeen, markReturned, markOpened, setConsent, speak, lang } = useApp();
  const [win, setWin] = useState<Win | null>(null);
  const { scored } = usePehchaan();
  const [toast, setToast] = useState<{ title: string; kn?: string; optout?: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const waiting = Object.values(sent).some((v) => v.code && v.returned == null);
  const state = useRef({ sent, seen, lang });
  state.current = { sent, seen, lang };

  // One handler for every source: server events (Paytm app, WhatsApp) and local ones heard over sound.
  const handle = useRef<(e: LoopEvent) => void>(() => {});
  handle.current = (e: LoopEvent) => {
    const mine = state.current.sent[e.id];
    if (!mine || mine.code !== e.code || mine.returned != null) return;
    const who = scored.find((x) => x.c.id === e.id);
    const name = who?.c.name ?? "Customer";
    const first = name.split(" ")[0];
    if (e.type === "opened") {
      markOpened(e.id);
      setToast({ title: `${first} opened the offer on their phone`, kn: "Waiting for them to redeem…" });
    } else if (e.type === "redeemed") {
      markReturned(e.id, true);
      setToast(null);
      const say = lines.back(first);
      setWin({ name, line: say[state.current.lang], kannada: state.current.lang === "kn", monthly: who?.monthly ?? 0, offer: mine.offer, visits: (who?.c.visits.length ?? 0) + 1 });
      speak(say);
    } else if (e.type === "optout") {
      markReturned(e.id, false);
      setConsent(e.id, "withdrawn");
      setToast({ title: `${name} stopped offers — consent withdrawn`, optout: true });
    }
  };

  useEffect(() => {
    const local = (ev: Event) => handle.current((ev as CustomEvent<LoopEvent>).detail);
    window.addEventListener("pehchaan-local-event", local);
    return () => window.removeEventListener("pehchaan-local-event", local);
  }, []);

  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const tick = async () => {
      try {
        const { events } = (await fetch(`/api/offers/events?since=${state.current.seen}`, { cache: "no-store" }).then((r) => r.json())) as { events: LoopEvent[] };
        for (const e of events) {
          setSeen(e.t);
          handle.current(e);
        }
      } catch {}
      if (!stop) setTimeout(tick, 2000);
    };
    tick();
    return () => { stop = true; };
  }, [waiting, setSeen]);

  useGSAP(() => {
    if (toast && box.current) gsap.fromTo(box.current, { y: -24, autoAlpha: 0, scale: 0.96, xPercent: -50 }, { y: 0, autoAlpha: 1, scale: 1, xPercent: -50, duration: 0.6, ease: "expo.out" });
  }, { dependencies: [toast] });

  if (win) return <WinMoment win={win} onDone={() => setWin(null)} />;
  if (!toast) return null;
  return (
    <div ref={box} onClick={() => setToast(null)} style={{ position: "fixed", left: "50%", top: 72, zIndex: 95, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px 14px 14px", borderRadius: 14, background: "var(--text)", color: "#fff", boxShadow: "var(--shadow-3)", cursor: "pointer", maxWidth: 400 }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: toast.optout ? "var(--text-3)" : "var(--good)", flex: "none" }}>{toast.optout ? <BellOff size={16} /> : <Smartphone size={16} />}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <b style={{ fontSize: 14 }}>{toast.title}</b>
        {toast.kn && <small className="kn" style={{ fontSize: 13, color: "#b9bac2" }}>{toast.kn}</small>}
        <small style={{ fontSize: 12, color: "#8d8d94" }}>Live from the customer&apos;s phone</small>
      </span>
    </div>
  );
}
