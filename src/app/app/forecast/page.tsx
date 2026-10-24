"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, FileStack, QrCode, Receipt } from "lucide-react";
import { CumulativeChart } from "@/components/charts";
import { CountUp } from "@/components/motion";
import { COMPOSITION_RATE, THRESHOLD, inr } from "@/lib/gst";
import { L, useLedger } from "@/lib/useLedger";
import s from "./forecast.module.css";

export default function Forecast() {
  const { fc, sum, prevSum } = useLedger();
  const base = Math.round((fc.growth - 1) * 100);
  const [g, setG] = useState(base);

  // Rescale the not-yet-happened part of the year to the chosen growth rate.
  const model = useMemo(() => {
    const k = (1 + g / 100) / fc.growth;
    let run = 0, actual = 0;
    let crossing: string | null = null;
    const pts = fc.series.map((m) => {
      const v = m.isFuture ? m.projected * k : m.isNow ? m.business + (m.projected - m.business) * k : m.business;
      run += v;
      if (!m.isFuture) actual += m.business;
      if (!crossing && run >= THRESHOLD) crossing = `${m.label} ${m.key.slice(0, 4)}`;
      return { label: m.label, actual: m.isFuture ? null : actual, projected: m.isFuture || m.isNow ? run : null };
    });
    return { pts, total: run, crossing: crossing as string | null };
  }, [fc, g]);

  const taxable = model.total * (1 - sum.mix.exemptShare);
  const comp = taxable * COMPOSITION_RATE;
  const daysLeft = model.crossing ? Math.round((new Date(`1 ${model.crossing}`).getTime() - new Date("2026-10-24").getTime()) / 86400000) : null;

  const recs = [
    { icon: CalendarClock, title: model.crossing ? `Register before ${model.crossing}` : "No registration needed this year", body: model.crossing ? `Apply for GST under the composition scheme (Form CMP-02) at least 30 days ahead. ${daysLeft} days to go.` : "At this growth rate you stay under ₹40L. Kavach keeps watching every month.", tone: model.crossing ? "warn" : "good" },
    { icon: Receipt, title: `Composition tax ≈ ${inr(comp)} a year`, body: `1% on taxable sales only (${L(taxable)}). Fresh vegetables and fruits stay exempt — ${Math.round(sum.mix.exemptShare * 100)}% of your sales.`, tone: "info" },
    { icon: QrCode, title: "Keep business on the Paytm merchant QR", body: "Ask family to send money to your personal account, not the shop QR. Separate accounts make every future notice a one-page reply.", tone: "info" },
    { icon: FileStack, title: `${sum.mix.n} supplier bills already matched`, body: "APMC and FMCG purchase payments prove your sales mix. Kavach keeps them as evidence automatically.", tone: "good" },
  ];

  return (
    <div className={s.page}>
      <section className={s.kpis}>
        <div className="card" data-in>
          <span className={s.kLabel}>Business YTD · FY 26–27</span>
          <span className={`mono ${s.kVal}`}><CountUp value={fc.ytd} format={L} /></span>
          <span className={s.kSub}>vs {L(prevSum.business)} all of last year</span>
        </div>
        <div className="card" data-in>
          <span className={s.kLabel}>Projected by 31 March</span>
          <span className={`mono ${s.kVal}`}><CountUp value={model.total} format={L} duration={0.6} /></span>
          <span className={s.kSub}>at {g}% growth on last year</span>
        </div>
        <div className={`card ${model.crossing ? s.warnCard : s.goodCard}`} data-in>
          <span className={s.kLabel}>{model.crossing ? "Crosses ₹40L in" : "Stays under ₹40L"}</span>
          <span className={s.kVal}>{model.crossing ?? "Safe"}</span>
          <span className={s.kSub}>{daysLeft != null ? `${daysLeft} days from today` : "Through 31 March 2027"}</span>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Scenario</div>
            <div className="card-sub">Drag to test slower or faster growth than this year&apos;s trend ({base}%)</div>
          </div>
          <div className={s.slider}>
            <span className="t3">0%</span>
            <input type="range" min={0} max={40} value={g} onChange={(e) => setG(+e.target.value)} />
            <span className="t3">40%</span>
            <b className="mono">{g}%</b>
          </div>
        </div>
        <div className="card-body">
          <CumulativeChart points={model.pts} threshold={THRESHOLD} fmt={L} height={320} />
        </div>
      </section>

      <section className={s.recs}>
        {recs.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.title} className={`card ${s.rec}`} data-in>
              <span className={`${s.rIcon} ${s[r.tone]}`}><Icon size={17} /></span>
              <b>{r.title}</b>
              <p>{r.body}</p>
            </div>
          );
        })}
      </section>

      <p className={s.note}><BadgeCheck size={14} />Section 22 CGST/KGST: ₹40L for goods-only suppliers in Karnataka. Aggregate turnover includes exempt sales; loans, family transfers and refunds are excluded.</p>
    </div>
  );
}
