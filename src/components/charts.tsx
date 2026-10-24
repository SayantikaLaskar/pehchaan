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

export function CumulativeChart({ points, threshold, height = 280, fmt, limitLabel = "Registration limit", names = { actual: "Actual", projected: "Projected" }, marker }: {
  points: CumPoint[]; threshold?: number; height?: number; fmt: (n: number) => string; limitLabel?: string;
  names?: { actual: string; projected: string }; marker?: { index: number; label: string };
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max((threshold ?? 0) * 1.15, ...points.map((p) => Math.max(p.actual ?? 0, p.projected ?? 0))) * 1.02);
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
          {points.map((p, i) => {
            const every = Math.max(1, Math.ceil(52 / Math.max(1, iw / points.length)));
            return i % every === 0 || i === points.length - 1 ? <text key={i} x={x(i)} y={height - 8} className={s.tick} textAnchor="middle">{p.label}</text> : null;
          })}
          <path d={area} fill="var(--c-sale)" fillOpacity={0.1} data-fade />
          {proj.length > 1 && <path d={line(proj)} fill="none" stroke="var(--c-sale)" strokeWidth={2} strokeDasharray="5 5" data-dash="5 5" data-draw opacity={0.7} />}
          <path d={line(actual)} fill="none" stroke="var(--c-sale)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" data-draw />
          {threshold != null && (
            <>
              <line x1={pad.l} x2={w - pad.r} y1={y(threshold)} y2={y(threshold)} className={s.limit} />
              <g transform={`translate(${pad.l + 8},${y(threshold) - 8})`}>
                <text className={s.limitLabel}>{limitLabel} · {axis(fmt(threshold))}</text>
              </g>
            </>
          )}
          {marker && (
            <g>
              <line x1={x(marker.index)} x2={x(marker.index)} y1={pad.t} y2={pad.t + ih} className={s.marker} />
              <text x={x(marker.index) + 6} y={pad.t + 10} className={s.markerLabel}>{marker.label}</text>
            </g>
          )}
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
          {hp.actual != null && <span><i style={{ background: "var(--c-sale)" }} />{names.actual} <em className="mono">{fmt(hp.actual)}</em></span>}
          {hp.projected != null && <span><i className={s.dashKey} />{names.projected} <em className="mono">{fmt(hp.projected)}</em></span>}
          {threshold != null && <span className="t3">{limitLabel} <em className="mono">{fmt(threshold)}</em></span>}
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

/* ───────────── Grouped bars (predicted vs actual) ───────────── */

export function GroupedBars({ groups, names, height = 260, fmt }: { groups: { label: string; a: number; b: number }[]; names: [string, string]; height?: number; fmt: (n: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 8, t: 10, b: 28 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...groups.flatMap((g) => [g.a, g.b])) * 1.05);
  const slot = iw / groups.length, bw = Math.min(22, slot * 0.3);
  const y = (v: number) => (v / max) * ih;
  return (
    <div ref={ref} className={s.wrap} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} className={s.svg}>
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih - k * ih} y2={pad.t + ih - k * ih} className={s.grid} />
              <text x={pad.l - 8} y={pad.t + ih - k * ih} className={s.tick} textAnchor="end" dominantBaseline="middle">{axis(fmt(k * max))}</text>
            </g>
          ))}
          {groups.map((g, i) => {
            const cx = pad.l + slot * i + slot / 2, base = pad.t + ih;
            return (
              <g key={g.label} onMouseEnter={() => setHover(i)} style={{ opacity: hover == null || hover === i ? 1 : 0.45, transition: "opacity .2s" }}>
                <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
                <path className={s.grow} style={{ animationDelay: `${i * 60}ms` }} d={col(cx - bw - 1, base - y(g.a), bw, y(g.a), 4)} fill="var(--border-strong)" />
                <path className={s.grow} style={{ animationDelay: `${i * 60 + 30}ms` }} d={col(cx + 1, base - y(g.b), bw, y(g.b), 4)} fill="var(--c-sale)" />
                <text x={cx} y={height - 8} className={s.tick} textAnchor="middle">{g.label}</text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <div className={s.tip} style={{ left: Math.min(pad.l + slot * hover + slot / 2 + 14, w - 180), top: 8 }}>
          <b>{groups[hover].label}</b>
          <span><i style={{ background: "var(--border-strong)" }} />{names[0]} <em className="mono">{fmt(groups[hover].a)}</em></span>
          <span><i style={{ background: "var(--c-sale)" }} />{names[1]} <em className="mono">{fmt(groups[hover].b)}</em></span>
        </div>
      )}
    </div>
  );
}

/* ───────────── P(alive) decay with visit ticks ───────────── */

export function DecayChart({ points, height = 180 }: { points: { t: number; p: number; visit: boolean }[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 8, t: 10, b: 30 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * iw;
  const y = (p: number) => pad.t + ih - p * ih;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.p)}`).join(" ");
  const scope = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    const path = scope.current?.querySelector<SVGPathElement>("[data-draw]");
    if (!path) return;
    const len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" });
  }, { dependencies: [w, points.length, points[0]?.p], scope });
  const hp = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className={s.wrap} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg ref={scope} width={w} height={height} className={s.svg}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - r.left - pad.l) / iw) * (points.length - 1)))));
          }}>
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={pad.l} x2={w - pad.r} y1={y(k)} y2={y(k)} className={s.grid} />
              <text x={pad.l - 8} y={y(k)} className={s.tick} textAnchor="end" dominantBaseline="middle">{Math.round(k * 100)}%</text>
            </g>
          ))}
          <path d={`${d} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--c-sale)" fillOpacity={0.08} />
          <path d={d} data-draw fill="none" stroke="var(--c-sale)" strokeWidth={2} strokeLinejoin="round" />
          {points.map((p, i) => p.visit && <line key={i} x1={x(i)} x2={x(i)} y1={pad.t + ih + 6} y2={pad.t + ih + 14} stroke="var(--text-2)" strokeWidth={1.5} />)}
          <text x={pad.l} y={height - 2} className={s.tick}>visits</text>
          {hp && <circle cx={x(hover!)} cy={y(hp.p)} r={4.5} fill="var(--c-sale)" stroke="var(--surface)" strokeWidth={2} />}
        </svg>
      )}
      {hp && (
        <div className={s.tip} style={{ left: Math.min(x(hover!) + 12, w - 170), top: 6 }}>
          <b>{new Date(hp.t).toISOString().slice(0, 10)}</b>
          <span>Still a regular <em className="mono">{Math.round(hp.p * 100)}%</em></span>
          {hp.visit && <span className="t3">Visited this day</span>}
        </div>
      )}
    </div>
  );
}
