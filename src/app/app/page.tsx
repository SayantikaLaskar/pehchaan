"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, BellRing, Play, QrCode, Volume2 } from "lucide-react";
import { AskSoundbox } from "@/components/AskSoundbox";
import { CountUp } from "@/components/motion";
import { Composition, CumulativeChart } from "@/components/charts";
import { useApp } from "@/components/Providers";
import { SEGMENTS, type Segment } from "@/lib/pehchaan/model";
import { LANGS, lines } from "@/lib/pehchaan/i18n";
import { L, gapText, inr, useLive } from "@/lib/pehchaan/use";
import type { Brief } from "@/lib/ai";
import s from "./overview.module.css";

export default function Today() {
  const { speak, speaking, sent, markReturned, lang } = useApp();
  const { scored, winnable, shock, expectedToday, net } = useLive();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [toast, setToast] = useState<{ name: string; days: number } | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const active = scored.filter((x) => x.segment === "champion" || x.segment === "loyal").length;
  const atRiskRevenue = winnable.reduce((sum, x) => sum + x.monthly, 0);
  const sentIds = Object.keys(sent);
  const back = sentIds.filter((id) => sent[id].returned).length;

  useEffect(() => {
    fetch("/api/brief", {
      method: "POST",
      body: JSON.stringify({
        slipping: winnable.slice(0, 3).map((x) => ({ name: x.c.name.split(" ")[0], lastSeen: Math.round(x.lastSeen), usual: Math.round(x.avgGap) })),
        expectedToday, revenueAtRisk: Math.round(atRiskRevenue), areaAlert: net.merchants[0].flagged,
      }),
    }).then((r) => r.json()).then(({ brief }) => setBrief(brief));
  }, [winnable, expectedToday, atRiskRevenue, net]);

  const weekly = shock.weekly.slice(-20);
  const detIdx = weekly.findIndex((w) => w.label === shock.detectedWeek);
  const parts = (Object.keys(SEGMENTS) as Segment[]).map((k) => ({ key: k, label: SEGMENTS[k].label, value: scored.filter((x) => x.segment === k).length, color: SEGMENTS[k].color }));

  // Demo: a lapsed regular pays at the counter and the Soundbox recognises them.
  const counter = useMemo(() => winnable.find((x) => sent[x.c.id] && !sent[x.c.id].returned) ?? winnable[0], [winnable, sent]);
  const simulate = () => {
    if (!counter) return;
    const days = Math.round(counter.lastSeen);
    const first = counter.c.name.split(" ")[0];
    setToast({ name: counter.c.name, days });
    if (sent[counter.c.id]) markReturned(counter.c.id, true);
    speak(lines.back(first, days));
  };
  useGSAP(() => {
    if (toast && toastRef.current) gsap.fromTo(toastRef.current, { y: 30, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: "expo.out" });
  }, { dependencies: [toast] });

  return (
    <div className={s.page}>
      <section className={s.kpis}>
        <Kpi label="Active regulars" value={active} f={(n) => Math.round(n).toString()} sub={`of ${scored.length} UPI customers recognised`} />
        <Kpi label="Slipping away" value={winnable.length} f={(n) => Math.round(n).toString()} sub="stopped recently · still winnable" warn />
        <Kpi label="Spend walking away" value={atRiskRevenue} f={L} sub="per month, from those customers" warn />
        <Kpi label="Won back" value={back} f={(n) => Math.round(n).toString()} sub={sentIds.length ? `of ${sentIds.length} offers sent` : "no offers sent yet"} good />
      </section>

      <section className={s.row2}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Weekly visits vs what the model expected</div>
              <div className="card-sub">Expectation from the churn model as it stood on 15 Aug · the gap is customers lost to something new</div>
            </div>
            <div className={s.legend}>
              <span><i style={{ background: "var(--c-sale)" }} />Actual</span>
              <span><i className={s.dashKey} />Expected</span>
            </div>
          </div>
          <div className="card-body">
            <CumulativeChart
              points={weekly.map((w) => ({ label: w.label, actual: w.actual, projected: w.expected }))}
              fmt={(n) => Math.round(n).toString()}
              names={{ actual: "Visits", projected: "Expected" }}
              marker={detIdx >= 0 ? { index: detIdx, label: "Pehchaan alert" } : undefined}
            />
            <p className={s.note}>
              Since mid-August, visits are running <b>{Math.abs(Math.round(shock.gapPct * 100))}% below</b> the model&apos;s expectation — and{" "}
              <b>{Math.abs(Math.round(shock.rings[0].gapPct * 100))}% below</b> for customers in one corner of the neighbourhood.{" "}
              <Link href="/app/radar" className={s.link}>See where <ArrowRight size={13} /></Link>
            </p>
          </div>
        </div>

        <div className={`card ${s.brief}`} data-in>
          <div className={s.briefHead}>
            <span className={s.sbx}><Volume2 size={14} /></span>
            <span><b>Morning brief</b><small>Soundbox · 7:30 am · {LANGS.find((l) => l.k === lang)?.label}</small></span>
          </div>
          <div className={`kn ${s.briefKn}`}>{brief ? (brief[lang] || brief.en) : <span className="skeleton" style={{ display: "block", height: 96 }} />}</div>
          {lang !== "en" && <p className={s.briefEn}>{brief?.en}</p>}
          <button className="btn" disabled={!brief || speaking} onClick={() => brief && speak(brief)}>
            <Play size={14} />{speaking ? "Speaking…" : "Play on Soundbox"}
          </button>
          <div className={s.askWrap}><span className={s.askLabel}>Ask the Soundbox</span><AskSoundbox dark /></div>
        </div>
      </section>

      <section className={s.row3}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Slipping away</div>
              <div className="card-sub">Ranked by monthly spend × how likely they&apos;re gone</div>
            </div>
            <Link href="/app/winback" className="btn btn-primary btn-sm">Win them back <ArrowRight size={14} /></Link>
          </div>
          <div className={s.table}>
            <div className={s.th}><span>Customer</span><span>Usually</span><span>Last seen</span><span>Still a regular</span><span>Monthly</span></div>
            {winnable.slice(0, 7).map((x) => (
              <Link key={x.c.id} href={`/app/customers?id=${x.c.id}`} className={s.tr}>
                <span className={s.who}><span className={s.av}>{x.c.name.split(" ").map((p) => p[0]).join("")}</span><b>{x.c.name}</b></span>
                <span className="t2">{gapText(x.avgGap)}</span>
                <span className="mono">{Math.round(x.lastSeen)}d ago</span>
                <span className={s.alive}>
                  <i><b style={{ width: `${x.pAlive * 100}%` }} /></i>
                  <span className="mono">{Math.round(x.pAlive * 100)}%</span>
                  <small className="mono">was {Math.round(x.pAlive30 * 100)}%</small>
                </span>
                <span className="mono">{inr(x.monthly)}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className={s.stack}>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Your customers</div><span className="card-sub">{scored.length} recognised</span></div>
            <div className="card-body"><Composition parts={parts} fmt={(n) => Math.round(n).toString()} /></div>
          </div>
          <div className={`card ${s.counter}`} data-in>
            <div className="card-head"><div className="card-title">At the counter</div><QrCode size={16} className="t3" /></div>
            <div className="card-body">
              <p className="t2" style={{ fontSize: 13 }}>When a lapsed regular pays, the Soundbox tells you who they are — so you can greet them by name.</p>
              <button className="btn btn-secondary" style={{ marginTop: 12, width: "100%" }} onClick={simulate} disabled={!counter}>
                <BellRing size={14} />Simulate {counter?.c.name.split(" ")[0]}&apos;s payment
              </button>
            </div>
          </div>
        </div>
      </section>

      {toast && (
        <div ref={toastRef} className={s.toast} onClick={() => setToast(null)}>
          <span className={s.toastIcon}><QrCode size={16} /></span>
          <span>
            <b>{toast.name} is back after {toast.days} days</b>
            <small className="kn">{toast.name.split(" ")[0]} ಅವರು {toast.days} ದಿನಗಳ ನಂತರ ಮತ್ತೆ ಬಂದಿದ್ದಾರೆ</small>
          </span>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, f, sub, warn, good }: { label: string; value: number; f: (n: number) => string; sub: string; warn?: boolean; good?: boolean }) {
  return (
    <div className={`card ${s.kpi}`} data-in>
      <span className={s.kLabel}>{label}</span>
      <span className={`mono ${s.kValue} ${warn ? s.warnT : ""} ${good ? s.goodT : ""}`}><CountUp value={value} format={f} /></span>
      <span className={s.kSub}>{sub}</span>
    </div>
  );
}
