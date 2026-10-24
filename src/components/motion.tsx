"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Tween a number into a text node, formatting each frame. */
export function CountUp({ value, format, duration = 1.6, delay = 0, className }: {
  value: number; format: (n: number) => string; duration?: number; delay?: number; className?: string;
}) {
  const el = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useGSAP(
    () => {
      const o = { v: last.current };
      gsap.to(o, {
        v: value, duration, delay, ease: "expo.out",
        onUpdate: () => { if (el.current) el.current.textContent = format(o.v); },
        onComplete: () => { last.current = value; },
      });
    },
    { dependencies: [value] },
  );
  return <span ref={el} className={className}>{format(last.current)}</span>;
}
