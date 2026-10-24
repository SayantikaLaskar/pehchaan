"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BellRing, Crosshair, Eye, EyeOff, Megaphone, Pause, Play, Users } from "lucide-react";
import { DARK_STORE, rng } from "@/lib/pehchaan/sim";
import { WEEKS, weekLabel, type Merchant } from "@/lib/pehchaan/network";
import { usePehchaan } from "@/lib/pehchaan/use";
import s from "./radar.module.css";

const V = 2200;

// Drop at week w vs the 12-week baseline, lightly smoothed.
function dropAt(m: Merchant, w: number) {
  const base = m.weekly.slice(0, 12).reduce((a, v) => a + v, 0) / 12;
  const win = m.weekly.slice(Math.max(0, w - 1), w + 1);
  return (win.reduce((a, v) => a + v, 0) / win.length - base) / base;
}

const color = (d: number) => {
  const k = Math.max(0, Math.min(1, -d / 0.25));
  return k < 0.15 ? "var(--border-strong)" : `color-mix(in srgb, var(--bad) ${Math.round(25 + k * 75)}%, var(--warn))`;
};

export default function Radar() {
  const { net, shock } = usePehchaan();
  const [week, setWeek] = useState(WEEKS - 1);
  const [playing, setPlaying] = useState(false);
  const [truth, setTruth] = useState(false);
  const [hover, setHover] = useState<Merchant | null>(null);
  const scope = useRef<HTMLDivElement>(null);

  const alertWeek = useMemo(() => {
    const ws = net.merchants.filter((m) => m.flagged && m.onsetWeek != null).map((m) => m.onsetWeek!);
    return ws.length ? Math.min(...ws) + 2 : WEEKS;
  }, [net]);
  const showZone = week >= alertWeek;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setWeek((w) => (w >= WEEKS - 1 ? (setPlaying(false), w) : w + 1)), 450);
    return () => clearInterval(id);
  }, [playing]);

  const streets = useMemo(() => {
    const r = rng(11), out: { x1: number; y1: number; x2: number; y2: number; main?: boolean }[] = [];
    for (let k = -V; k <= V; k += 220) {
      const a = -V + r() * 600, b = V - r() * 600;
      out.push({ x1: k + (r() - 0.5) * 40, y1: a, x2: k + (r() - 0.5) * 40, y2: b });
      out.push({ x1: a, y1: k + (r() - 0.5) * 40, x2: b, y2: k + (r() - 0.5) * 40 });
    }
    out.push({ x1: -V, y1: 900, x2: V, y2: -1500, main: true });
    out.push({ x1: -300, y1: -V, x2: 200, y2: V, main: true });
    return out;
  }, []);

  useGSAP(() => {
    gsap.from(`.${s.dot}`, { scale: 0, transformOrigin: "center", duration: 0.8, ease: "back.out(2)", stagger: 0.015 });
  }, { scope });
  useGSAP(() => {
    if (showZone) gsap.fromTo(`.${s.zone}`, { scale: 0.4, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: 1, ease: "expo.out" });
  }, { scope, dependencies: [showZone] });

  const flagged = net.merchants.filter((m) => m.flagged).sort((a, b) => a.drop - b.drop);
  const onsets = flagged.map((m) => m.onsetWeek).filter((w): w is number => w != null);
  const followers = onsets.filter((w) => w > Math.min(...onsets) && w <= Math.min(...onsets) + 3).length;
  const inf = net.inferred;

  return (
    <div className={s.page} ref={scope}>
      <section className={s.kpis}>
        <K k="Merchants watched" v={String(net.merchants.length)} sub="HSR Layout & around · Paytm QR" />
        <K k="Regulars dropping off" v={String(net.flaggedCount)} sub="shops > 7% below their own baseline" warn />
        <K k="Change began" v={`wk of ${net.firstAlert}`} sub={`${followers} more shops dipped within 3 weeks — not a coincidence`} />
        <K k="Source located within" v={`${Math.round(inf.errorM / 10) * 10} m`} sub="from aggregate drops only — no store data" good />
      </section>

      <section className={s.grid}>
        <div className={`card ${s.mapCard}`} data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Regulars lost vs each shop&apos;s own baseline</div>
              <div className="card-sub">Week of {weekLabel(week)} · darker = more regulars gone</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setTruth(!truth)}>{truth ? <EyeOff size={14} /> : <Eye size={14} />}{truth ? "Hide" : "Reveal"} ground truth</button>
          </div>
          <div className={s.mapWrap} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`${-V} ${-V} ${V * 2} ${V * 2}`} className={s.map}>
              <defs>
                <radialGradient id="zone">
                  <stop offset="0%" stopColor="var(--bad)" stopOpacity="0.32" />
                  <stop offset="70%" stopColor="var(--bad)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--bad)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x={-V} y={-V} width={V * 2} height={V * 2} fill="var(--surface-2)" />
              {streets.map(({ main, ...l }, i) => <line key={i} {...l} className={main ? s.main : s.street} />)}
              {[500, 1000, 1500, 2000].map((r) => <circle key={r} r={r} className={s.ring} />)}
              {showZone && (
                <g className={s.zone}>
                  <circle cx={inf.x} cy={inf.y} r={inf.decayM * 2.2} fill="url(#zone)" />
                  <circle cx={inf.x} cy={inf.y} r={inf.decayM} className={s.zoneEdge} />
                  <g transform={`translate(${inf.x},${inf.y})`} className={s.cross}>
                    <line x1={-70} x2={70} y1={0} y2={0} /><line x1={0} x2={0} y1={-70} y2={70} />
                  </g>
                  <text x={inf.x} y={inf.y - inf.decayM - 130} className={s.zoneLabel} textAnchor="middle">Inferred: new store</text>
                  <text x={inf.x} y={inf.y - inf.decayM - 40} className={s.zoneSub} textAnchor="middle">opened ~wk of {net.firstAlert}</text>
                </g>
              )}
              {truth && (
                <g>
                  <line x1={inf.x} y1={inf.y} x2={DARK_STORE.x} y2={DARK_STORE.y} className={s.errLine} />
                  <rect x={DARK_STORE.x - 55} y={DARK_STORE.y - 55} width={110} height={110} rx={22} className={s.truth} />
                  <text x={DARK_STORE.x + 80} y={DARK_STORE.y + 150} className={s.truthLabel}>Actual dark store · {Math.round(inf.errorM)} m off</text>
                </g>
              )}
              {net.merchants.map((m) => {
                const d = dropAt(m, week);
                const hot = d < -0.07;
                return (
                  <g key={m.id} transform={`translate(${m.x},${m.y})`} onMouseEnter={() => setHover(m)} className={s.dotG}>
                    {hot && <circle r={130} className={s.pulse} style={{ stroke: color(d) }} />}
                    <circle r={m.self ? 95 : 70} className={s.dot} style={{ fill: color(d) }} />
                    {m.self && <circle r={140} className={s.selfRing} />}
                    {m.self && <text y={-175} className={s.selfLabel} textAnchor="middle">Your shop</text>}
                  </g>
                );
              })}
            </svg>
            {hover && (
              <div className={s.tip}>
                <b>{hover.name}</b>
                <span className="t3">{hover.cat}</span>
                <span>Regulars vs baseline <em className="mono">{(dropAt(hover, week) * 100).toFixed(0)}%</em></span>
              </div>
            )}
          </div>
          <div className={s.scrub}>
            <button className="btn btn-secondary btn-sm" onClick={() => { if (week >= WEEKS - 1) setWeek(0); setPlaying(!playing); }}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
            <input type="range" min={0} max={WEEKS - 1} value={week} onChange={(e) => { setPlaying(false); setWeek(+e.target.value); }} />
            <span className="mono">{weekLabel(week)}</span>
          </div>
          <div className={s.scale}><span>No change</span><i /><span>−25% regulars</span></div>
        </div>

        <div className={s.side}>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Shops affected</div><span className="badge badge-warn">{flagged.length}</span></div>
            <ul className={s.list}>
              {flagged.map((m) => (
                <li key={m.id}>
                  <span className={s.sw} style={{ background: color(m.drop) }} />
                  <span><b>{m.name}{m.self ? " (you)" : ""}</b><small>{m.cat} · {Math.round(Math.hypot(m.x - inf.x, m.y - inf.y))} m from hotspot</small></span>
                  <span className="mono">{(m.drop * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">How it&apos;s found</div><Crosshair size={15} className="t3" /></div>
            <ol className={s.how}>
              <li>Each shop&apos;s weekly count of active regulars is compared with its own 12-week baseline (z-score + CUSUM change point).</li>
              <li>A drop at one shop is noise. The same drop in the same week at {net.flaggedCount} nearby shops is a signal.</li>
              <li>Paytm fits a decay model <span className="mono">drop ∝ e^(−d/L)</span> over the map and finds the point that explains every shop&apos;s drop best (L ≈ {inf.decayM} m).</li>
            </ol>
          </div>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Paytm can act</div></div>
            <div className={s.actions}>
              <button className="btn btn-primary btn-sm"><BellRing size={14} />Alert {net.flaggedCount} merchants</button>
              <button className="btn btn-secondary btn-sm"><Megaphone size={14} />Pre-fund win-back offers</button>
              <button className="btn btn-secondary btn-sm"><Users size={14} />Brief field sales team</button>
            </div>
            <p className={s.valid}>Validation on our own shop&apos;s customers: visits fell <b>{Math.abs(Math.round(shock.rings[0].gapPct * 100))}%</b> below expectation within 500 m of the store, <b>{Math.abs(Math.round(shock.rings[1].gapPct * 100))}%</b> at 0.5–1 km, and <b>~{Math.abs(Math.round(shock.rings[2].gapPct * 100))}%</b> beyond 1 km.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function K({ k, v, sub, warn, good }: { k: string; v: string; sub: string; warn?: boolean; good?: boolean }) {
  return (
    <div className="card" data-in>
      <span className={s.kL}>{k}</span>
      <b className={`mono ${warn ? s.warn : ""} ${good ? s.good : ""}`}>{v}</b>
      <small>{sub}</small>
    </div>
  );
}
