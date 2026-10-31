"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BellOff, Smartphone } from "lucide-react";
import { useApp } from "./Providers";
import { lines } from "@/lib/pehchaan/i18n";
import { usePehchaan } from "@/lib/pehchaan/use";

interface Event { t: number; type: "redeemed" | "optout"; code: string; id: string }

// Listens for customers acting on their phones and reflects it on the dashboard and the Soundbox.
export function LiveLoop() {
  const { sent, seen, setSeen, markReturned, setConsent, speak } = useApp();
  const { scored } = usePehchaan();
  const [toast, setToast] = useState<{ title: string; kn?: string; optout?: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const waiting = Object.values(sent).some((v) => v.code && v.returned == null);
  const state = useRef({ sent, seen });
  state.current = { sent, seen };

  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const tick = async () => {
      try {
        const { events } = (await fetch(`/api/offers/events?since=${state.current.seen}`, { cache: "no-store" }).then((r) => r.json())) as { events: Event[] };
        for (const e of events) {
          setSeen(e.t);
          const mine = state.current.sent[e.id];
          if (!mine || mine.code !== e.code || mine.returned != null) continue;
          const name = scored.find((x) => x.c.id === e.id)?.c.name ?? "Customer";
          const first = name.split(" ")[0];
          if (e.type === "redeemed") {
            markReturned(e.id, true);
            setToast({ title: `${name} redeemed the offer — won back`, kn: `${first} ಅವರು ಮತ್ತೆ ಬಂದಿದ್ದಾರೆ!` });
            speak(lines.back(first));
          } else {
            markReturned(e.id, false);
            setConsent(e.id, "withdrawn");
            setToast({ title: `${name} stopped offers — consent withdrawn`, optout: true });
          }
        }
      } catch {}
      if (!stop) setTimeout(tick, 2000);
    };
    tick();
    return () => { stop = true; };
  }, [waiting, scored, setSeen, markReturned, setConsent, speak]);

  useGSAP(() => {
    if (toast && box.current) gsap.fromTo(box.current, { y: 30, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: "expo.out" });
  }, { dependencies: [toast] });

  if (!toast) return null;
  return (
    <div ref={box} onClick={() => setToast(null)} style={{ position: "fixed", right: 24, bottom: 24, zIndex: 95, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px 14px 14px", borderRadius: 14, background: "var(--text)", color: "#fff", boxShadow: "var(--shadow-3)", cursor: "pointer", maxWidth: 400 }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: toast.optout ? "var(--text-3)" : "var(--good)", flex: "none" }}>{toast.optout ? <BellOff size={16} /> : <Smartphone size={16} />}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <b style={{ fontSize: 14 }}>{toast.title}</b>
        {toast.kn && <small className="kn" style={{ fontSize: 13, color: "#b9bac2" }}>{toast.kn}</small>}
        <small style={{ fontSize: 12, color: "#8d8d94" }}>Live from the customer&apos;s phone</small>
      </span>
    </div>
  );
}
