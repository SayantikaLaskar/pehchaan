"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Bot, PhoneCall, Radar, Send, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/motion";
import { CumulativeChart } from "@/components/charts";
import s from "./pulse.module.css";

type Stage = "watching" | "report" | "called" | "recovered";
const STAGE: Record<Stage, { label: string; cls: string }> = {
  watching: { label: "Watching", cls: "badge" },
  report: { label: "Report sent", cls: "badge badge-info" },
  called: { label: "Called in Kannada", cls: "badge badge-warn" },
  recovered: { label: "QR back on", cls: "badge badge-good" },
};

const MERCHANTS: { name: string; area: string; cat: string; signal: string; gmv: number; risk: number; stage: Stage }[] = [
  { name: "Lakshmi Darshini", area: "Basavanagudi", cat: "Tiffin", signal: "QR scans 0 for 6 days", gmv: 3.1, risk: 96, stage: "called" },
  { name: "Sri Ganesh Fruits", area: "Jayanagar 4th Blk", cat: "Fruits", signal: "Collections −46% in 3 weeks", gmv: 2.4, risk: 92, stage: "recovered" },
  { name: "Raghu Tender Coconut", area: "HSR Sec 6", cat: "Street", signal: "Collections −61%, cash spike", gmv: 1.2, risk: 88, stage: "called" },
  { name: "Kumar Juice Centre", area: "Malleshwaram", cat: "Juice", signal: "Collections −52%", gmv: 1.9, risk: 85, stage: "recovered" },
  { name: "Sri Venkateshwara Veg", area: "Banashankari", cat: "Vegetables", signal: "Collections −38% in 2 weeks", gmv: 2.8, risk: 81, stage: "recovered" },
  { name: "Ayesha Bangles", area: "Shivajinagar", cat: "Retail", signal: "Device return requested", gmv: 1.4, risk: 77, stage: "watching" },
  { name: "Mahalakshmi Provisions", area: "BTM 2nd Stg", cat: "Kirana", signal: "Asked Soundbox about “tax notice”", gmv: 3.6, risk: 74, stage: "report" },
  { name: "Nandini Milk Parlour", area: "Koramangala", cat: "Dairy", signal: "Settlement moved to personal a/c", gmv: 2.2, risk: 69, stage: "report" },
];

const FEED: [string, string, typeof Radar][] = [
  ["Detected", "Sri Ganesh Fruits: collections down 46% over 21 days. Device healthy.", Radar],
  ["Reasoned", "Matches post-notice pattern: cash share up, ticket size unchanged.", Bot],
  ["Built", "Kavach report — 14 months sorted. Business ₹31.2L, below ₹40L.", TrendingUp],
  ["Called", "Kannada voice call (Sarvam). Explained report, offered a reply draft.", PhoneCall],
  ["Sent", "Report + reply draft on WhatsApp. Looped in a Jayanagar CA partner.", Send],
  ["Recovered", "First QR payment in 6 days — ₹2,140 in the first hour.", TrendingUp],
  ["Detected", "Lakshmi Darshini: zero QR scans for 6 days in breakfast peak.", Radar],
  ["Called", "Officer visited last week. Drafted reply, booked a field-agent visit.", PhoneCall],
];

const SERIES = [100, 101, 99, 102, 98, 95, 88, 79, 72, 68, 66, 64, 63, 65, 69, 74, 80, 85, 89, 92, 94, 95, 96, 97];

export default function Pulse() {
  const [feed, setFeed] = useState<{ id: number; t: string; k: string; d: string; I: typeof Radar }[]>([]);
  const i = useRef(0);
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const push = () => {
      const id = i.current++;
      const [k, d, I] = FEED[id % FEED.length];
      const t = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setFeed((f) => [{ id, t, k, d, I }, ...f].slice(0, 6));
    };
    push(); push(); push();
    const id = setInterval(push, 2800);
    return () => clearInterval(id);
  }, []);

  useGSAP(() => { gsap.from(`.${s.feed} li:first-child`, { y: -12, autoAlpha: 0, duration: 0.6, ease: "expo.out" }); }, { scope, dependencies: [feed[0]?.id] });

  const pts = useMemo(() => SERIES.map((v, x) => ({ label: x % 4 === 0 ? `D${x + 1}` : "", actual: v, projected: null })), []);

  return (
    <div className={s.page} ref={scope}>
      <div className={s.banner} data-in>
        <span className="badge badge-info">Paytm internal</span>
        <span>Bengaluru South cluster · simulated cohort for demo</span>
      </div>

      <section className={s.kpis}>
        <K label="Merchants monitored" v={18420} f={(n) => Math.round(n).toLocaleString("en-IN")} sub="Soundbox + QR, Bengaluru South" />
        <K label="Drifting to cash" v={1274} f={(n) => Math.round(n).toLocaleString("en-IN")} sub="UPI −30% or more in 3 weeks" warn />
        <K label="Monthly UPI volume at risk" v={38.2} f={(n) => `₹${n.toFixed(1)} Cr`} sub="if they stay on cash" />
        <K label="Recovered after Kavach" v={71} f={(n) => `${Math.round(n)}%`} sub="QR active again within 14 days" good />
      </section>

      <section className={s.two}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Cohort UPI volume (indexed)</div>
              <div className="card-sub">Merchants who received notices · Kavach switched on at day 12</div>
            </div>
          </div>
          <div className="card-body"><CumulativeChart points={pts} threshold={70} fmt={(n) => String(Math.round(n))} height={260} limitLabel="Churn alert" /></div>
        </div>

        <div className="card" data-in>
          <div className="card-head">
            <div className="card-title">Agent log</div>
            <span className="badge badge-good"><span className={s.livePulse} />Live</span>
          </div>
          <ul className={s.feed}>
            {feed.map((f) => {
              const I = f.I;
              return (
                <li key={f.id}>
                  <span className={s.fIcon}><I size={14} /></span>
                  <span><b>{f.k}</b> {f.d}</span>
                  <small className="mono t3">{f.t}</small>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Merchants at risk</div>
            <div className="card-sub">Ranked by likelihood of going cash-only this month</div>
          </div>
        </div>
        <div className={s.table}>
          <div className={s.th}><span>Merchant</span><span>Signal</span><span>Monthly UPI</span><span>Risk</span><span>Agent status</span></div>
          {MERCHANTS.map((m) => (
            <div key={m.name} className={s.tr}>
              <span className={s.m}><span className={s.av}>{m.name.slice(0, 1)}</span><span><b>{m.name}</b><small>{m.cat} · {m.area}</small></span></span>
              <span className="t2">{m.signal}</span>
              <span className="mono">₹{m.gmv.toFixed(1)}L</span>
              <span className={s.risk}><i><b style={{ width: `${m.risk}%`, background: m.risk >= 85 ? "var(--bad)" : m.risk >= 75 ? "var(--warn)" : "var(--text-3)" }} /></i><span className="mono">{m.risk}</span></span>
              <span><span className={STAGE[m.stage].cls}>{STAGE[m.stage].label}</span></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function K({ label, v, f, sub, warn, good }: { label: string; v: number; f: (n: number) => string; sub: string; warn?: boolean; good?: boolean }) {
  return (
    <div className="card" data-in>
      <span className={s.kLabel}>{label}</span>
      <span className={`mono ${s.kVal} ${warn ? s.kWarn : ""} ${good ? s.kGood : ""}`}><CountUp value={v} format={f} /></span>
      <span className={s.kSub}>{sub}</span>
    </div>
  );
}
