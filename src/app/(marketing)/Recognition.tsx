"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Volume2 } from "lucide-react";
import { SEGMENTS } from "@/lib/pehchaan/model";
import { gapText, usePehchaan } from "@/lib/pehchaan/use";
import s from "./recognition.module.css";

gsap.registerPlugin(ScrollTrigger);

interface Beat {
  name: string;
  vpa: string;
  amount: number;
  visitsFrom: number;
  visitsTo: number;
  usual: string;
  pFrom: number;
  pTo: number;
  badge: string;
  badgeColor: string;
  note: string;
  kn: string;
}

// A payment lands on the Soundbox and resolves into a person — three kinds of moment, on loop.
export function Recognition() {
  const { scored, winnable } = usePehchaan();
  const beats = useMemo<Beat[]>(() => {
    const champ = scored.filter((x) => x.segment === "champion").sort((a, b) => b.c.visits.length - a.c.visits.length)[0];
    const back = winnable[0];
    const fresh = scored.find((x) => x.segment === "new") ?? scored[5];
    const first = (n: string) => n.split(" ")[0];
    return [
      {
        name: champ.c.name, vpa: champ.c.vpa, amount: 240, visitsFrom: champ.c.visits.length, visitsTo: champ.c.visits.length + 1,
        usual: gapText(champ.avgGap), pFrom: champ.pAlive, pTo: Math.min(0.99, champ.pAlive + 0.01),
        badge: SEGMENTS.champion.label, badgeColor: SEGMENTS.champion.color, note: "Regular as clockwork",
        kn: `${first(champ.c.name)} ಅವರೇ, ನಮಸ್ಕಾರ!`,
      },
      {
        name: back.c.name, vpa: back.c.vpa, amount: 520, visitsFrom: back.c.visits.length, visitsTo: back.c.visits.length + 1,
        usual: gapText(back.avgGap), pFrom: back.pAlive, pTo: 0.9,
        badge: "Won back", badgeColor: "var(--good)", note: `Back after ${Math.round(back.lastSeen)} days`,
        kn: `${first(back.c.name)} ಅವರು ${Math.round(back.lastSeen)} ದಿನಗಳ ನಂತರ ಮತ್ತೆ ಬಂದಿದ್ದಾರೆ!`,
      },
      {
        name: fresh.c.name, vpa: fresh.c.vpa, amount: 180, visitsFrom: 0, visitsTo: 1,
        usual: "first visit", pFrom: 0, pTo: 1,
        badge: SEGMENTS.new.label, badgeColor: SEGMENTS.new.color, note: "New face — remembered from today",
        kn: `ಹೊಸ ಗ್ರಾಹಕರು — ಸ್ವಾಗತ!`,
      },
    ];
  }, [scored, winnable]);

  const [i, setI] = useState(0);
  const [live, setLive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const b = beats[i];

  useGSAP(() => {
    ScrollTrigger.create({ trigger: root.current, start: "top 75%", end: "bottom 20%", onToggle: (st) => setLive(st.isActive) });
  }, { scope: root });

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setI((x) => (x + 1) % beats.length), 5200);
    return () => clearInterval(id);
  }, [live, beats.length]);

  useGSAP(() => {
    if (!live) return;
    const visits = { v: b.visitsFrom }, p = { v: b.pFrom };
    const el = (sel: string) => root.current!.querySelector(sel) as HTMLElement;
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(`.${s.amount}`, { y: 24, autoAlpha: 0, scale: 0.9 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6 })
      .fromTo(`.${s.ripple}`, { scale: 0.4, autoAlpha: 0.8 }, { scale: 2.6, autoAlpha: 0, duration: 1.4, stagger: 0.18, ease: "power2.out" }, 0.1)
      .fromTo(`.${s.beam}`, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, 0.5)
      .fromTo(`.${s.card}`, { x: 24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.7 }, 0.85)
      .fromTo(`.${s.avatar}`, { scale: 0 }, { scale: 1, duration: 0.6, ease: "back.out(2.4)" }, 0.95)
      .fromTo(`.${s.line}`, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08 }, 1.05)
      .to(visits, { v: b.visitsTo, duration: 0.9, ease: "power2.out", onUpdate: () => { el(`.${s.visits}`).textContent = String(Math.round(visits.v)); } }, 1.4)
      .to(p, { v: b.pTo, duration: 1.2, onUpdate: () => { el(`.${s.fill}`).style.width = `${p.v * 100}%`; el(`.${s.pct}`).textContent = `${Math.round(p.v * 100)}%`; } }, 1.5)
      .fromTo(`.${s.badge}`, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)" }, 2.1)
      .fromTo(`.${s.voice}`, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, 2.4)
      .fromTo(`.${s.wave} i`, { scaleY: 0.2 }, { scaleY: () => 0.4 + Math.random(), duration: 0.18, repeat: 9, yoyo: true, stagger: { each: 0.03, repeatRefresh: true } }, 2.5);
  }, { scope: root, dependencies: [i, live] });

  return (
    <section className={s.section} ref={root}>
      <div className={s.head}>
        <span className={s.eyebrow}><span className={s.liveDot} />Live on the Soundbox</span>
        <h2>One payment. <span className="serif">One person.</span></h2>
        <p>The moment a UPI payment lands, Pehchaan knows who it is, how often they come, and whether they were slipping away — and tells the shopkeeper out loud.</p>
      </div>

      <div className={s.stage}>
        <div className={s.device}>
          <div className={s.screen}>
            <span className={s.recv}>Payment received</span>
            <span className={`mono ${s.amount}`}>₹{b.amount}</span>
            <span className={s.upi}>UPI · Paytm QR</span>
          </div>
          <div className={s.speaker}>
            <span className={s.ripple} /><span className={s.ripple} /><span className={s.ripple} />
            <div className={s.grille}>{Array.from({ length: 49 }, (_, k) => <i key={k} />)}</div>
          </div>
          <span className={s.brand}>paytm soundbox</span>
        </div>

        <div className={s.beamWrap}><span className={s.beam} /></div>

        <div className={s.card}>
          <div className={s.top}>
            <span className={s.avatar}>{b.name.split(" ").map((p) => p[0]).join("")}</span>
            <div className={s.who}>
              <b className={s.line}>{b.name}</b>
              <span className={`mono ${s.line}`}>{b.vpa}</span>
            </div>
            <span className={s.badge} style={{ background: `color-mix(in srgb, ${b.badgeColor} 14%, white)`, color: b.badgeColor }}>{b.badge}</span>
          </div>
          <div className={`${s.stats} ${s.line}`}>
            <span><small>Visits</small><b className={`mono ${s.visits}`}>{b.visitsFrom}</b></span>
            <span><small>Usually</small><b>{b.usual}</b></span>
            <span><small>Today</small><b>{b.note}</b></span>
          </div>
          <div className={`${s.prob} ${s.line}`}>
            <small>Still a regular</small>
            <div className={s.bar}><span className={s.fill} /></div>
            <b className={`mono ${s.pct}`}>{Math.round(b.pFrom * 100)}%</b>
          </div>
          <div className={s.voice}>
            <span className={s.vIcon}><Volume2 size={14} /></span>
            <span className="kn">{b.kn}</span>
            <span className={s.wave}>{Array.from({ length: 14 }, (_, k) => <i key={k} />)}</span>
          </div>
        </div>
      </div>

      <div className={s.dots}>
        {beats.map((x, k) => <button key={k} aria-label={x.note} className={k === i ? s.dotOn : ""} onClick={() => setI(k)} />)}
      </div>
    </section>
  );
}
