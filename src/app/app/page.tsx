"use client";

import Link from "next/link";
import { dMedium } from "@/lib/format";
import { useMemo } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, FileText, Play, ShieldCheck, Volume2 } from "lucide-react";
import { CountUp } from "@/components/motion";
import { Composition, CumulativeChart, MonthlyColumns, Sparkline } from "@/components/charts";
import { useApp } from "@/components/Providers";
import { CLS_META, COMPOSITION_RATE, THRESHOLD, inr } from "@/lib/gst";
import { L, useLedger } from "@/lib/useLedger";
import s from "./overview.module.css";

const KN_MONTH: Record<string, string> = { Nov: "ನವೆಂಬರ್", Dec: "ಡಿಸೆಂಬರ್", Jan: "ಜನವರಿ", Feb: "ಫೆಬ್ರವರಿ", Mar: "ಮಾರ್ಚ್" };

export default function Overview() {
  const { speak, speaking } = useApp();
  const { sum, fc, months, pending, fyKey } = useLedger();
  const curr = fyKey === "curr";

  const cum = useMemo(() => {
    if (curr) return fc.series.map((m) => ({ label: m.label, actual: m.isFuture ? null : m.cumulative, projected: m.isFuture || m.isNow ? m.cumulative : null }));
    let run = 0;
    return months.map((m) => ({ label: m.label, actual: (run += m.business), projected: null }));
  }, [curr, fc, months]);

  const bars = curr
    ? fc.series.map((m) => ({ label: m.label, business: m.isFuture ? m.projected : m.business, other: m.isFuture ? 0 : m.other, projected: m.isFuture, now: m.isNow }))
    : months.map((m) => ({ label: m.label, business: m.business, other: m.other }));
  const shown = curr ? months.filter((_, i) => i <= fc.nowIndex) : months;
  const grossSpark = shown.map((m) => m.business + m.other);
  const bizSpark = shown.map((m) => m.business);
  const projected = curr ? fc.projectedTotal : sum.business;
  const headroom = THRESHOLD - projected;
  const compTax = projected * (1 - sum.mix.exemptShare) * COMPOSITION_RATE;
  const crossing = curr ? fc.crossing : null;

  const parts = (["sale", "personal", "loan", "own", "refund", "review"] as const).map((k) => ({ key: k, label: CLS_META[k].label, value: sum.by[k], color: CLS_META[k].tone }));

  const activity = [
    { t: "2m", icon: CheckCircle2, tone: "good", text: <>Sorted <b>{sum.payments.toLocaleString("en-IN")}</b> payments for {sum.fy.label}</> },
    { t: "1h", icon: CircleAlert, tone: "warn", text: <>Notice <b>ASMT-10/08817</b> received — reply draft ready</> },
    { t: "3h", icon: Volume2, tone: "info", text: <>Asked about <b>Green Bowl Cafe ₹36,000</b> on Soundbox</> },
    { t: "1d", icon: FileText, tone: "info", text: <>Matched <b>{sum.mix.n}</b> supplier payments to infer sales mix</> },
  ];

  return (
    <div className={s.page}>
      <section className={s.kpis}>
        <Kpi label="UPI credits received" value={sum.gross} sub={`${sum.payments.toLocaleString("en-IN")} payments`} spark={grossSpark} color="var(--border-strong)" />
        <Kpi label="Business turnover" value={sum.business} sub={`${((sum.business / sum.gross) * 100).toFixed(0)}% of credits`} spark={bizSpark} color="var(--c-sale)" delta={curr ? `+${Math.round((fc.growth - 1) * 100)}% YoY` : undefined} />
        <Kpi label="Set aside — not income" value={sum.nonBusiness} sub="family, loans, own, refunds" />
        <div className={`card ${s.kpi}`} data-in>
          <span className={s.kLabel}>{curr ? "Headroom to ₹40L (projected)" : "Headroom to ₹40L"}</span>
          <span className={`mono ${s.kValue} ${headroom < 0 ? s.neg : ""}`}><CountUp value={headroom} format={(n) => (n < 0 ? "−" : "") + L(Math.abs(n))} /></span>
          <div className={s.meter}><span style={{ width: `${Math.min(100, (projected / THRESHOLD) * 100)}%`, background: headroom < 0 ? "var(--warn)" : "var(--c-sale)" }} /></div>
          <span className={s.kSub}>{Math.round((projected / THRESHOLD) * 100)}% of limit used</span>
        </div>
      </section>

      <section className={s.row2}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Cumulative business turnover</div>
              <div className="card-sub">{curr ? "Actual to date, projected to 31 March" : "Full year"} · against the Section 22 limit</div>
            </div>
            <div className={s.legend}>
              <span><i style={{ background: "var(--c-sale)" }} />Actual</span>
              {curr && <span><i className={s.dashKey} />Projected</span>}
              <span><i className={s.limitKey} />Limit</span>
            </div>
          </div>
          <div className="card-body"><CumulativeChart points={cum} threshold={THRESHOLD} fmt={L} /></div>
        </div>

        <div className={`card ${s.status}`} data-in>
          <div className="card-head">
            <div className="card-title">Compliance status</div>
            {crossing ? <span className="badge badge-warn"><CircleAlert />Watch</span> : <span className="badge badge-good"><ShieldCheck />Safe</span>}
          </div>
          <div className="card-body">
            <p className={s.statusLine}>
              {crossing ? <>At this pace you cross ₹40L in <b>{crossing}</b>. Register under composition before then.</> : <>Turnover is below ₹40L. <b>No registration needed.</b></>}
            </p>
            <ul className={s.checks}>
              <li><span>Registration</span><b>{crossing ? "Due before " + crossing.split(" ")[0] : "Not required"}</b></li>
              <li><span>Composition tax (est.)</span><b className="mono">{inr(compTax)}/yr</b></li>
              <li><span>Exempt share of sales</span><b className="mono">{Math.round(sum.mix.exemptShare * 100)}%</b></li>
              <li><span>Open notices</span><b><Link href="/app/notices" className={s.link}>1 · reply ready <ArrowUpRight size={13} /></Link></b></li>
              <li><span>Evidence on file</span><b>{sum.mix.n} bills · 3 lender letters</b></li>
            </ul>
            <button
              className="btn btn-secondary"
              disabled={speaking}
              onClick={() =>
                crossing
                  ? speak(`ಮಂಜುನಾಥ್ ಅವರೇ, ಈ ವೇಗದಲ್ಲಿ ನಿಮ್ಮ ವ್ಯಾಪಾರ ${KN_MONTH[crossing.split(" ")[0]] ?? crossing} ತಿಂಗಳಲ್ಲಿ ನಲವತ್ತು ಲಕ್ಷ ದಾಟುತ್ತದೆ. ಈಗಲೇ ಕಾಂಪೋಸಿಷನ್ ಯೋಜನೆಯಲ್ಲಿ ನೋಂದಣಿ ಮಾಡಿ. ತರಕಾರಿಗೆ ತೆರಿಗೆ ಇಲ್ಲ.`, `Manjunath, at this pace you will cross forty lakh in ${crossing}. Register under the composition scheme now. Vegetables stay tax free.`)
                  : speak("ಮಂಜುನಾಥ್ ಅವರೇ, ನಿಮ್ಮ ನಿಜವಾದ ವ್ಯಾಪಾರ ನಲವತ್ತು ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ. ಧೈರ್ಯವಾಗಿ UPI ತೆಗೆದುಕೊಳ್ಳಿ.", "Manjunath, your real business is below forty lakh. Keep accepting UPI with confidence.")
              }
            >
              <Play size={14} />{speaking ? "Speaking…" : "Explain in Kannada"}
            </button>
          </div>
        </div>
      </section>

      <section className={s.row3}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Where the money came from</div>
              <div className="card-sub">{sum.fy.label} · {L(sum.gross)} in UPI credits</div>
            </div>
            <Link href="/app/transactions" className="btn btn-ghost btn-sm">All transactions <ArrowRight size={14} /></Link>
          </div>
          <div className="card-body"><Composition parts={parts} fmt={L} /></div>
        </div>

        <div className={s.stack}>
          <div className="card" data-in>
            <div className="card-head">
              <div className="card-title">Needs your answer</div>
              <span className="badge">{pending.length} open</span>
            </div>
            <div className="card-body">
              {pending.length === 0 ? (
                <p className="t3">All clear — every credit is classified.</p>
              ) : (
                <ul className={s.queue}>
                  {pending.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <span><b>{t.payer}</b><small>{dMedium(t.date)}</small></span>
                      <span className="mono">{inr(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/app/review" className="btn btn-secondary btn-sm" style={{ marginTop: 12, width: "100%" }}>Open review queue</Link>
            </div>
          </div>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Kavach activity</div></div>
            <div className="card-body">
              <ul className={s.activity}>
                {activity.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <li key={i}>
                      <span className={`${s.aIcon} ${s[a.tone]}`}><Icon size={14} /></span>
                      <span>{a.text}</span>
                      <small className="t3">{a.t}</small>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Month by month</div>
            <div className="card-sub">Business sales vs other credits{curr ? " · hatched months are projected" : ""}</div>
          </div>
          <div className={s.legend}>
            <span><i style={{ background: "var(--c-sale)" }} />Business</span>
            <span><i style={{ background: "var(--border-strong)" }} />Non-business</span>
          </div>
        </div>
        <div className="card-body"><MonthlyColumns bars={bars} fmt={L} /></div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, spark, color, delta }: { label: string; value: number; sub: string; spark?: number[]; color?: string; delta?: string }) {
  return (
    <div className={`card ${s.kpi}`} data-in>
      <span className={s.kLabel}>{label}</span>
      <span className={`mono ${s.kValue}`}><CountUp value={value} format={L} /></span>
      <span className={s.kSub}>{sub}{delta && <em className="badge badge-good">{delta}</em>}</span>
      {spark && spark.length > 1 && <div className={s.spark}><Sparkline values={spark} color={color} /></div>}
    </div>
  );
}
