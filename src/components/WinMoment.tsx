"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Check } from "lucide-react";
import s from "./winmoment.module.css";

export interface Win { name: string; line: string; kannada: boolean; monthly: number; offer: number; visits: number }

const COLORS = ["#00b9f1", "#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#ffffff"];

/** Full-screen moment when a customer redeems on their phone: phone → beam → Soundbox → welcome. */
export function WinMoment({ win, onDone }: { win: Win; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const path = root.current!.querySelector(`.${s.beam}`) as SVGPathElement;
    const len = path.getTotalLength();
    const dot = { p: 0 };
    const amount = { v: 0 };
    const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: () => { gsap.delayedCall(2.2, () => gsap.to(root.current, { autoAlpha: 0, duration: 0.5, onComplete: onDone })); } });
    tl.from(root.current, { autoAlpha: 0, duration: 0.35, ease: "power2.out" })
      .from(q(`.${s.phone}`), { x: -60, rotate: -8, autoAlpha: 0, duration: 0.8 }, 0.1)
      .from(q(`.${s.box}`), { x: 60, rotate: 6, autoAlpha: 0, duration: 0.8 }, 0.15)
      .from(q(`.${s.tick}`), { scale: 0, duration: 0.5, ease: "back.out(3)" }, 0.5)
      .fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, 0.7)
      .to(dot, { p: 1, duration: 0.7, ease: "power2.inOut", onUpdate: () => {
        const pt = path.getPointAtLength(dot.p * len);
        gsap.set(q(`.${s.spark}`), { attr: { cx: pt.x, cy: pt.y } });
      } }, 0.7)
      .fromTo(q(`.${s.ring}`), { scale: 0.4, autoAlpha: 0.9 }, { scale: 2.6, autoAlpha: 0, duration: 1.3, stagger: 0.15, ease: "power2.out" }, 1.35)
      .from(q(`.${s.title} span`), { yPercent: 110, duration: 0.9, stagger: 0.08 }, 1.4)
      .from(q(`.${s.line}`), { y: 16, autoAlpha: 0, duration: 0.6 }, 1.65)
      .from(q(`.${s.chip}`), { y: 20, autoAlpha: 0, scale: 0.9, duration: 0.6, stagger: 0.08, ease: "back.out(2)" }, 1.8)
      .to(amount, { v: win.monthly, duration: 1.2, ease: "power2.out", onUpdate: () => { const el = q(`.${s.money}`)[0]; if (el) el.textContent = `+₹${Math.round(amount.v).toLocaleString("en-IN")}/mo`; } }, 1.85);

    // Confetti from the Soundbox.
    q(`.${s.bit}`).forEach((el, i) => {
      const a = (Math.PI * 2 * i) / 70 + Math.random() * 0.4;
      const v = 220 + Math.random() * 320;
      tl.fromTo(el, { x: 0, y: 0, rotate: 0, autoAlpha: 1 }, { x: Math.cos(a) * v, y: Math.sin(a) * v * 0.7 + 260, rotate: Math.random() * 720 - 360, autoAlpha: 0, duration: 1.8 + Math.random() * 0.6, ease: "power2.out" }, 1.4);
    });
  }, { scope: root });

  const first = win.name.split(" ")[0];
  return (
    <div className={s.root} ref={root} onClick={onDone} role="dialog" aria-label={`${win.name} is back`}>
      <div className={s.stage}>
        <div className={s.phone}>
          <div className={s.notch} />
          <span className={s.tick}><Check size={28} /></span>
          <b>Redeemed</b>
          <small>₹{win.offer} store offer</small>
        </div>
        <svg className={s.svg} viewBox="0 0 300 120" aria-hidden>
          <path className={s.beam} d="M10 90 C 90 -10, 210 -10, 290 90" />
          <circle className={s.spark} r="6" cx="10" cy="90" />
        </svg>
        <div className={s.box}>
          <div className={s.screen}>₹ {win.offer} off</div>
          <div className={s.spk}>{[0, 1, 2].map((i) => <i key={i} className={s.ring} />)}<div className={s.grille} /></div>
          <div className={s.confetti}>{Array.from({ length: 70 }, (_, i) => <i key={i} className={s.bit} style={{ background: COLORS[i % COLORS.length] }} />)}</div>
        </div>
      </div>
      <h2 className={s.title}><span>{first} is</span> <span className={s.serif}>back.</span></h2>
      <p className={`${s.line} ${win.kannada ? "kn" : ""}`}>{win.line}</p>
      <div className={s.chips}>
        <span className={s.chip}>Visit <b className="mono">{win.visits}</b></span>
        <span className={`${s.chip} ${s.good}`}><b className={`mono ${s.money}`}>+₹0/mo</b> spend recovered</span>
        <span className={s.chip}>Won back by the agent</span>
      </div>
    </div>
  );
}
