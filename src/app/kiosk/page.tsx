"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, BadgePercent, Pause, Play, Volume2 } from "lucide-react";
import { useCounter } from "@/lib/pehchaan/counter";
import type { Scored } from "@/lib/pehchaan/model";
import { AskSoundbox } from "@/components/AskSoundbox";
import { SoundListener } from "@/components/SoundListener";
import { LiveLoop } from "@/components/LiveLoop";
import { Logo } from "@/components/Logo";
import { useApp } from "@/components/Providers";
import { maskVpa } from "@/lib/pehchaan/consent";
import { LANGS, lines, type Say } from "@/lib/pehchaan/i18n";
import { SEGMENTS } from "@/lib/pehchaan/model";
import { rng } from "@/lib/pehchaan/sim";
import { gapText, usePehchaan } from "@/lib/pehchaan/use";
import s from "./kiosk.module.css";

interface Beat { name: string; vpa: string; amount: number; visits: number; usual: string; p: number; badge: string; color: string; note: string; say: Say }

// Full-screen Soundbox for the counter, the stage and the demo video.
export default function Kiosk() {
  const { scored, winnable } = usePehchaan();
  const { lang, setLang, speak, sent } = useApp();
  const pay = useCounter();
  const [started, setStarted] = useState(false);
  const [live, setLive] = useState(true);
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  // A repeatable stream: mostly regulars, now and then a lapsed regular coming back, and a new face.
  const beats = useMemo<Beat[]>(() => {
    const r = rng(5);
    const champs = scored.filter((x) => x.segment === "champion" || x.segment === "loyal").sort((a, b) => b.c.visits.length - a.c.visits.length).slice(0, 12);
    const back = winnable.slice(0, 4);
    const out: Beat[] = [];
    for (let k = 0; k < 12; k++) {
      if (k % 4 === 2 && back[k >> 2]) {
        const x = back[k >> 2], f = x.c.name.split(" ")[0];
        out.push({ name: x.c.name, vpa: x.c.vpa, amount: Math.round(x.spend / 10) * 10, visits: x.c.visits.length + 1, usual: gapText(x.avgGap), p: 0.9, badge: "Back after " + Math.round(x.lastSeen) + " days", color: "var(--good)", note: `Was ${Math.round(x.pAlive * 100)}% likely to still be a regular`, say: lines.back(f, Math.round(x.lastSeen)) });
      } else if (k === 7) {
        out.push({ name: "New customer", vpa: "kiran.r21@okaxis", amount: 140, visits: 1, usual: "first visit", p: 1, badge: SEGMENTS.new.label, color: SEGMENTS.new.color, note: "Remembered from today", say: lines.newFace() });
      } else {
        const x = champs[k % champs.length], f = x.c.name.split(" ")[0];
        out.push({ name: x.c.name, vpa: x.c.vpa, amount: Math.round((x.spend * (0.7 + r() * 0.6)) / 10) * 10, visits: x.c.visits.length + 1, usual: gapText(x.avgGap), p: x.pAlive, badge: SEGMENTS[x.segment].label, color: SEGMENTS[x.segment].color, note: `Visit ${x.c.visits.length + 1}`, say: lines.regular(f) });
      }
    }
    return out;
  }, [scored, winnable]);
  // Customers holding an offer from the agent. When one of them pays, the offer is applied right here,
  // matched by UPI ID — they need no app, no link and no data on their phone.
  const pending = useMemo(() => scored.filter((x) => sent[x.c.id]?.code && sent[x.c.id].returned == null), [scored, sent]);
  const [special, setSpecial] = useState<{ beat: Beat; n: number } | null>(null);
  const applyAt = (x: Scored) => {
    const amount = Math.round(x.spend / 10) * 10;
    const r = pay(x, amount);
    const f = x.c.name.split(" ")[0];
    setSpecial((p) => ({ n: (p?.n ?? 0) + 1, beat: { name: x.c.name, vpa: x.c.vpa, amount, visits: x.c.visits.length + 1, usual: gapText(x.avgGap), p: 0.9, badge: `₹${r.applied} offer applied`, color: "var(--good)", note: `Paid ₹${r.paid} · matched by UPI ID`, say: lines.applied(f, r.applied) } }));
  };
  const b = special?.beat ?? beats[i % beats.length];

  // The ambient stream only greets regulars; an offer is applied when the presenter presses "… pays",
  // so a demo never spends the agent's offers before the shop has gone offline.
  useEffect(() => {
    if (!started || !live) return;
    const id = setInterval(() => { setSpecial(null); setI((x) => x + 1); }, 7000);
    return () => clearInterval(id);
  }, [started, live]);

  useEffect(() => {
    if (started) speak(b.say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, started]);

  useGSAP(() => {
    if (!started) return;
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(`.${s.amount}`, { y: 30, autoAlpha: 0, scale: 0.9 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6 })
      .fromTo(`.${s.ripple}`, { scale: 0.4, autoAlpha: 0.8 }, { scale: 2.8, autoAlpha: 0, duration: 1.4, stagger: 0.18, ease: "power2.out" }, 0.05)
      .fromTo(`.${s.card}`, { x: 30, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.7 }, 0.5)
      .fromTo(`.${s.fill}`, { width: "0%" }, { width: `${b.p * 100}%`, duration: 1.1 }, 0.8)
      .fromTo(`.${s.say}`, { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }, 1);
  }, { scope: root, dependencies: [i, started, special?.n] });

  return (
    <main className={s.root} ref={root}>
      <header className={s.top}>
        <Link href="/app" className={s.back}><ArrowLeft size={16} />Dashboard</Link>
        <span className={s.brand}><Logo size={24} />Pehchaan · Sri Manjunatha Stores</span>
        <div className={s.controls}>
          <div className={s.langs}>{LANGS.map((l) => <button key={l.k} aria-pressed={lang === l.k} onClick={() => setLang(l.k)}>{l.label}</button>)}</div>
          <SoundListener compact />
          {started && pending[0] && <button className={s.ctl} onClick={() => applyAt(pending[0])} title="The next payment is from a customer holding an offer"><BadgePercent size={15} />{pending[0].c.name.split(" ")[0]} pays</button>}
          {started && <button className={s.ctl} onClick={() => setLive(!live)}>{live ? <Pause size={15} /> : <Play size={15} />}{live ? "Pause" : "Resume"}</button>}
        </div>
      </header>

      {!started ? (
        <button className={s.start} onClick={() => setStarted(true)}>
          <Volume2 size={22} /><b>Start the Soundbox</b><small>Payments arrive every few seconds and are greeted aloud</small>
        </button>
      ) : (
        <section className={s.stage}>
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
            <span className={s.dbrand}>paytm soundbox</span>
          </div>

          <div className={s.card}>
            <div className={s.cTop}>
              <span className={s.av}>{b.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
              <span className={s.who}><b>{b.name}</b><small className="mono">{maskVpa(b.vpa)}</small></span>
              <span className={s.badge} style={{ color: b.color, background: `color-mix(in srgb, ${b.color} 14%, white)` }}>{b.badge}</span>
            </div>
            <div className={s.stats}>
              <span><small>Visits</small><b className="mono">{b.visits}</b></span>
              <span><small>Usually</small><b>{b.usual}</b></span>
              <span><small>Note</small><b>{b.note}</b></span>
            </div>
            <div className={s.prob}><small>Still a regular</small><div className={s.bar}><span className={s.fill} /></div><b className="mono">{Math.round(b.p * 100)}%</b></div>
            <div className={s.say}><Volume2 size={16} /><span className={lang === "kn" ? "kn" : ""}>{b.say[lang]}</span></div>
          </div>
        </section>
      )}

      <LiveLoop />
      {started && <section className={s.ask}><span className={s.askLabel}>Ask the Soundbox</span><AskSoundbox dark /></section>}
    </main>
  );
}
