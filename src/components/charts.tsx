"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import s from "./charts.module.css";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const axis = (s: string) => s.replace(/\.0+(?=[LkC]|$)/, "");

const niceMax = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * p >= v)!;
  return step * p;
};

/* ───────────── Sparkline ───────────── */

export function Sparkline({ values, color = "var(--c-sale)", height = 36 }: { values: number[]; color?: string; height?: number }) {
  const W = 120;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={s.spark} style={{ height }}>
      <path d={`${d} L${W},${height} L0,${height} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── Cumulative turnover vs threshold ───────────── */

export interface CumPoint { label: string; actual: number | null; projected: number | null }

export function CumulativeChart({ points, threshold, height = 280, fmt, limitLabel = "Registration limit" }: { points: CumPoint[]; threshold: number; height?: number; fmt: (n: number) => string; limitLabel?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(threshold * 1.15, ...points.map((p) => Math.max(p.actual ?? 0, p.projected ?? 0))) * 1.02);
  const x = (i: number) => pad.l + (i / (points.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);

  const actual = points.map((p, i) => (p.actual == null ? null : [x(i), y(p.actual)] as const)).filter(Boolean) as (readonly [number, number])[];
  const lastActual = actual.length - 1;
  const proj = points.map((p, i) => (p.projected == null ? null : [x(i), y(p.projected)] as const)).filter(Boolean) as (readonly [number, number])[];
  const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = actual.length ? `${line(actual)} L${actual[lastActual][0]},${y(0)} L${actual[0][0]},${y(0)} Z` : "";

  const scope = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    if (!w) return;
    const paths = scope.current?.querySelectorAll<SVGPathElement>("[data-draw]");
    paths?.forEach((p) => {
      const len = p.getTotalLength();
      gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", onComplete: () => { if (p.dataset.dash) p.style.strokeDasharray = p.dataset.dash; } });
    });
    gsap.fromTo(scope.current!.querySelectorAll("[data-fade]"), { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.6 });
  }, { dependencies: [w, points.map((p) => p.actual).join()], scope });

  const hp = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className={s.wrap} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg ref={scope} width={w} height={height} className={s.svg}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className={s.grid} />
              <text x={pad.l - 10} y={y(t)} className={s.tick} textAnchor="end" dominantBaseline="middle">{axis(fmt(t))}</text>
            </g>
          ))}
          {points.map((p, i) => (
            <text key={i} x={x(i)} y={height - 8} className={s.tick} textAnchor="middle">{p.label}</text>
          ))}
          <path d={area} fill="var(--c-sale)" fillOpacity={0.1} data-fade />
          {proj.length > 1 && <path d={line(proj)} fill="none" stroke="var(--c-sale)" strokeWidth={2} strokeDasharray="5 5" data-dash="5 5" data-draw opacity={0.7} />}
          <path d={line(actual)} fill="none" stroke="var(--c-sale)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" data-draw />
          <line x1={pad.l} x2={w - pad.r} y1={y(threshold)} y2={y(threshold)} className={s.limit} />
          <g transform={`translate(${pad.l + 8},${y(threshold) - 8})`}>
            <text className={s.limitLabel}>{limitLabel} · {axis(fmt(threshold))}</text>
          </g>
          {actual.length > 0 && <circle cx={actual[lastActual][0]} cy={actual[lastActual][1]} r={5} fill="var(--c-sale)" stroke="var(--surface)" strokeWidth={2} />}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className={s.cross} />
              {hp?.actual != null && <circle cx={x(hover)} cy={y(hp.actual)} r={5} fill="var(--c-sale)" stroke="var(--surface)" strokeWidth={2} />}
              {hp?.actual == null && hp?.projected != null && <circle cx={x(hover)} cy={y(hp.projected)} r={5} fill="var(--surface)" stroke="var(--c-sale)" strokeWidth={2} />}
            </g>
          )}
        </svg>
      )}
      {hp && (
        <div className={s.tip} style={{ left: Math.min(x(hover!) + 12, w - 170), top: 12 }}>
          <b>{hp.label}</b>
          {hp.actual != null && <span><i style={{ background: "var(--c-sale)" }} />Actual <em className="mono">{fmt(hp.actual)}</em></span>}
          {hp.projected != null && hp.actual == null && <span><i className={s.dashKey} />Projected <em className="mono">{fmt(hp.projected)}</em></span>}
          <span className="t3">{limitLabel} <em className="mono">{fmt(threshold)}</em></span>
        </div>
      )}
    </div>
  );
}

/* ───────────── Monthly stacked columns ───────────── */

export interface MonthBar { label: string; business: number; other: number; projected?: boolean; now?: boolean }

export function MonthlyColumns({ bars, height = 240, fmt }: { bars: MonthBar[]; height?: number; fmt: (n: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...bars.map((b) => b.business + b.other)));
  const slot = iw / bars.length;
  const bw = Math.min(24, slot * 0.56);
  const y = (v: number) => (v / max) * ih;
  const scope = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    if (!w) return;
    gsap.fromTo(scope.current!.querySelectorAll("[data-col]"), { scaleY: 0 }, { scaleY: 1, transformOrigin: "50% 100%", duration: 1, ease: "expo.out", stagger: 0.04 });
  }, { dependencies: [w, bars.map((b) => b.business).join()], scope });

  return (
    <div ref={ref} className={s.wrap} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg ref={scope} width={w} height={height} className={s.svg}>
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih - k * ih} y2={pad.t + ih - k * ih} className={s.grid} />
              <text x={pad.l - 10} y={pad.t + ih - k * ih} className={s.tick} textAnchor="end" dominantBaseline="middle">{axis(fmt(k * max))}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = pad.l + slot * i + slot / 2;
            const hb = y(b.business), ho = y(b.other);
            const base = pad.t + ih;
            return (
              <g key={b.label} onMouseEnter={() => setHover(i)} style={{ opacity: hover == null || hover === i ? 1 : 0.45, transition: "opacity .2s" }}>
                <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
                <g data-col>
                  <path d={col(cx - bw / 2, base - hb, bw, hb, ho > 0 ? 0 : 4)}
                    fill={b.projected ? "url(#hatch)" : "var(--c-sale)"} stroke={b.projected ? "var(--c-sale)" : "none"} strokeWidth={b.projected ? 1.2 : 0} />
                  {ho > 0 && <path d={col(cx - bw / 2, base - hb - ho - 2, bw, ho, 4)} fill="var(--border-strong)" />}
                </g>
                <text x={cx} y={height - 8} className={`${s.tick} ${b.now ? s.tickNow : ""}`} textAnchor="middle">{b.label}</text>
              </g>
            );
          })}
          <defs>
            <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--surface)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--c-sale)" strokeWidth="1.2" opacity="0.5" />
            </pattern>
          </defs>
        </svg>
      )}
      {hover != null && (
        <div className={s.tip} style={{ left: Math.min(pad.l + slot * hover + slot / 2 + 14, w - 180), top: 8 }}>
          <b>{bars[hover].label}{bars[hover].projected ? " · projected" : ""}</b>
          <span><i style={{ background: "var(--c-sale)" }} />Business <em className="mono">{fmt(bars[hover].business)}</em></span>
          {bars[hover].other > 0 && <span><i style={{ background: "var(--border-strong)" }} />Non-business <em className="mono">{fmt(bars[hover].other)}</em></span>}
        </div>
      )}
    </div>
  );
}

// Column with a rounded data-end (top) and square baseline.
function col(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/* ───────────── Composition (100% stacked) ───────────── */

export function Composition({ parts, fmt }: { parts: { key: string; label: string; value: number; color: string }[]; fmt: (n: number) => string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current!.querySelectorAll("[data-seg]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "0 50%", duration: 1.2, ease: "expo.out", stagger: 0.06 });
  }, { scope: ref, dependencies: [total] });
  const visible = useMemo(() => parts.filter((p) => p.value > 0), [parts]);
  return (
    <div ref={ref} className={s.comp}>
      <div className={s.compBar}>
        {visible.map((p) => (
          <span key={p.key} data-seg title={`${p.label}: ${fmt(p.value)}`} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
            style={{ flexGrow: p.value, background: p.color, opacity: hover && hover !== p.key ? 0.35 : 1 }} />
        ))}
      </div>
      <ul className={s.legend}>
        {visible.map((p) => (
          <li key={p.key} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} className={hover === p.key ? s.lgOn : ""}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <em className="mono">{fmt(p.value)}</em>
            <small className="mono">{((p.value / total) * 100).toFixed(1)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
