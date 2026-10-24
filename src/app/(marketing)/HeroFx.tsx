"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePehchaan } from "@/lib/pehchaan/use";
import { SEGMENTS } from "@/lib/pehchaan/model";
import s from "./herofx.module.css";

// Side-gutter slots so pings never sit on top of the headline.
const SLOTS = [
  { left: "5%", top: "22%" }, { left: "9%", top: "48%" }, { left: "3%", top: "70%" },
  { right: "5%", top: "18%" }, { right: "8%", top: "44%" }, { right: "4%", top: "68%" },
];

/** Soundbox ripples + UPI payments resolving into people, behind the hero copy. */
export function HeroFx() {
  const { scored } = usePehchaan();
  const root = useRef<HTMLDivElement>(null);
  const people = useRef(scored.filter((x) => x.c.visits.length > 20).slice(0, 18));

  useGSAP(() => {
    gsap.fromTo(`.${s.ring}`, { scale: 0.3, autoAlpha: 0.55 }, { scale: 1.9, autoAlpha: 0, duration: 5.4, ease: "sine.out", stagger: { each: 1.35, repeat: -1 } });

    const chips = gsap.utils.toArray<HTMLElement>(`.${s.chip}`);
    let k = 0;
    chips.forEach((chip, i) => {
      const fill = () => {
        const p = people.current[k++ % people.current.length];
        chip.querySelector(`.${s.amt}`)!.textContent = `₹${Math.round(p.spend / 10) * 10} received`;
        chip.querySelector(`.${s.name}`)!.textContent = p.c.name;
        chip.querySelector(`.${s.meta}`)!.textContent = `visit ${p.c.visits.length} · ${SEGMENTS[p.segment].label.toLowerCase()}`;
        (chip.querySelector(`.${s.dot}`) as HTMLElement).style.background = SEGMENTS[p.segment].color;
      };
      const tl = gsap.timeline({ repeat: -1, delay: 0.8 + i * 1.1, repeatDelay: 2.4, onRepeat: fill });
      fill();
      gsap.set(chip.querySelector(`.${s.back}`), { yPercent: 100, autoAlpha: 0 });
      tl.fromTo(chip, { y: 24, autoAlpha: 0, scale: 0.92 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.7, ease: "expo.out" })
        .fromTo(chip.querySelector(`.${s.ping}`), { scale: 0.6, autoAlpha: 0.9 }, { scale: 2.2, autoAlpha: 0, duration: 1, ease: "power2.out" }, 0.1)
        .to(chip.querySelector(`.${s.front}`), { yPercent: -100, autoAlpha: 0, duration: 0.45, ease: "power3.in" }, 1.4)
        .fromTo(chip.querySelector(`.${s.back}`), { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.55, ease: "expo.out" }, 1.7)
        .to(chip, { y: -28, autoAlpha: 0, duration: 0.8, ease: "power2.in" }, 3.9)
        .set(chip.querySelector(`.${s.front}`), { yPercent: 0, autoAlpha: 1 })
        .set(chip.querySelector(`.${s.back}`), { yPercent: 100, autoAlpha: 0 });
    });

    // Gentle parallax with the pointer (desktop only).
    const mm = gsap.matchMedia();
    mm.add("(pointer: fine)", () => {
      const xTo = gsap.quickTo(`.${s.layer}`, "x", { duration: 1.2, ease: "power3" });
      const yTo = gsap.quickTo(`.${s.layer}`, "y", { duration: 1.2, ease: "power3" });
      const move = (e: PointerEvent) => { xTo((e.clientX / innerWidth - 0.5) * -24); yTo((e.clientY / innerHeight - 0.5) * -16); };
      addEventListener("pointermove", move);
      return () => removeEventListener("pointermove", move);
    });
  }, { scope: root });

  return (
    <div className={s.fx} ref={root} aria-hidden>
      <div className={s.layer}>
        <div className={s.rings}>{[0, 1, 2, 3].map((i) => <span key={i} className={s.ring} />)}</div>
        {SLOTS.map((pos, i) => (
          <div key={i} className={s.chip} style={pos}>
            <span className={s.ping} />
            <div className={s.flip}>
              <div className={s.front}><span className={s.upi}>UPI</span><b className={`mono ${s.amt}`} /></div>
              <div className={s.back}><span className={s.dot} /><span><b className={s.name} /><small className={s.meta} /></span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Headline word that cycles through real customers' names and lands back on "regular". */
export function RotatingWord({ className }: { className?: string }) {
  const { winnable, scored } = usePehchaan();
  const [words] = useState(() => {
    const champ = scored.filter((x) => x.segment === "champion")[0];
    return ["regular", "Sharma ji", winnable[0]?.c.name.split(" ")[0] ?? "Aisha", champ?.c.name.split(" ")[0] ?? "Ramesh", "regular"];
  });
  const box = useRef<HTMLSpanElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % (words.length - 1)), 2600);
    return () => clearInterval(id);
  }, [words.length]);

  useGSAP(() => {
    const el = box.current!;
    const items = el.querySelectorAll<HTMLElement>("[data-w]");
    const cur = items[i];
    gsap.to(el, { width: cur.offsetWidth, duration: 0.7, ease: "expo.out" });
    items.forEach((w, j) => {
      if (j === i) gsap.fromTo(w, { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.75, ease: "expo.out", delay: 0.08 });
      else gsap.to(w, { yPercent: -105, autoAlpha: 0, duration: 0.5, ease: "power3.in" });
    });
  }, { dependencies: [i] });

  return (
    <span ref={box} className={`${s.rot} ${className ?? ""}`}>
      {words.slice(0, -1).map((w, j) => (
        <span key={j} data-w className={s.rotWord} style={{ opacity: j === 0 ? 1 : 0 }}>{w}</span>
      ))}
    </span>
  );
}
