"use client";

import { use, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BellOff, Check, MapPin, Store } from "lucide-react";
import { Logo } from "@/components/Logo";
import { offerText } from "@/lib/pehchaan/i18n";
import s from "./offer.module.css";

interface Offer { code: string; first: string; kn: string; hi?: string; en: string; lang?: "kn" | "hi" | "en"; offer: number; shop: string; status: "sent" | "redeemed" | "optout" }

// What a customer sees on their phone: a Paytm notification from their kirana.
export default function OfferPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [o, setO] = useState<Offer | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const [embedded, setEmbedded] = useState<{ id: string; first: string; offer: number; lang: "kn" | "hi" | "en"; kn: string; hi: string; en: string } | null>(null);
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("d");
    let fromLink: typeof embedded = null;
    try {
      if (d) {
        const x = JSON.parse(decodeURIComponent(escape(atob(d.replace(/-/g, "+").replace(/_/g, "/"))))) as { i: string; f: string; o: number; l: "kn" | "hi" | "en" };
        fromLink = { id: x.i, first: x.f, offer: x.o, lang: x.l, ...offerText(x.f, x.o) };
      }
    } catch {}
    setEmbedded(fromLink);
    fetch(`/api/offers/${code}`, { method: "POST", body: JSON.stringify({ action: "open", offer: fromLink }) }).catch(() => {});
    fetch(`/api/offers/${code}`).then(async (r) => {
      if (r.ok) setO(await r.json());
      else if (fromLink) setO({ ...fromLink, code, shop: "Sri Manjunatha Stores", status: "sent" });
      else setErr((await r.json()).error);
    });
  }, [code]);

  useGSAP(() => {
    if (!o) return;
    gsap.from(`.${s.card}`, { y: -40, autoAlpha: 0, duration: 0.8, ease: "expo.out" });
    gsap.from(`.${s.ticket}`, { y: 30, autoAlpha: 0, duration: 0.8, delay: 0.25, ease: "expo.out" });
  }, { scope: root, dependencies: [o?.code] });

  useGSAP(() => {
    if (o?.status !== "redeemed") return;
    gsap.fromTo(`.${s.done}`, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2)" });
    gsap.utils.toArray<HTMLElement>(`.${s.bit}`).forEach((el, i) => {
      const a = (Math.PI * 2 * i) / 36 + Math.random() * 0.3, v = 120 + Math.random() * 160;
      gsap.fromTo(el, { x: 0, y: 0, autoAlpha: 1, rotate: 0 }, { x: Math.cos(a) * v, y: Math.sin(a) * v + 180, rotate: Math.random() * 540, autoAlpha: 0, duration: 1.6 + Math.random() * 0.5, ease: "power2.out" });
    });
  }, { scope: root, dependencies: [o?.status] });

  const act = async (action: "redeem" | "optout") => {
    setBusy(true);
    const r = await fetch(`/api/offers/${code}`, { method: "POST", body: JSON.stringify({ action, offer: embedded }) });
    setO(await r.json());
    setBusy(false);
  };

  return (
    <main className={s.screen} ref={root}>
      <div className={s.status}><span>9:41</span><span>Paytm</span></div>
      {err && <p className={s.err}>{err}</p>}
      {o && (
        <>
          <div className={s.card}>
            <div className={s.head}><span className={s.app}>P</span><b>Paytm</b><small>now</small></div>
            <b className={s.title}>{o.shop} · ₹{o.offer} off for you</b>
            <p className="kn">{(o.lang && o[o.lang]) || o.kn || o.en}</p>
            {o.lang !== "en" && <p className={s.en}>{o.en}</p>}
          </div>

          <div className={s.ticket}>
            <div className={s.shop}><Store size={18} /><span><b>{o.shop}</b><small><MapPin size={11} />HSR Layout Sector 2</small></span></div>
            {o.status === "sent" && (
              <>
                <div className={s.amount}><span>Store offer</span><b className="mono">₹{o.offer}</b><small>on your next visit · this week</small></div>
                <button className={s.redeem} disabled={busy} onClick={() => act("redeem")}>Redeem at the store</button>
                <button className={s.optout} disabled={busy} onClick={() => act("optout")}><BellOff size={13} />Stop offers from this store</button>
              </>
            )}
            {o.status === "redeemed" && (
              <div className={s.done}>
                <span className={s.tick}><Check size={28} /><span className={s.burst}>{Array.from({ length: 36 }, (_, i) => <i key={i} className={s.bit} style={{ background: ["#00b9f1", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4"][i % 5] }} />)}</span></span>
                <b>Welcome back, {o.first}!</b>
                <p>₹{o.offer} off applied — show this at the counter.</p>
              </div>
            )}
            {o.status === "optout" && (
              <div className={s.done}>
                <span className={`${s.tick} ${s.grey}`}><BellOff size={24} /></span>
                <b>You won&apos;t get offers from this store</b>
                <p>Your choice is saved in the store&apos;s consent ledger.</p>
              </div>
            )}
          </div>
          <p className={s.fine}><Logo size={14} /> Sent by Pehchaan for Paytm merchants · only because you opted in</p>
        </>
      )}
    </main>
  );
}
