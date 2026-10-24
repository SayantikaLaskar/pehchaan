"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Bot, Check, CircleDashed, Loader2, Play, RotateCcw, Send, Sparkles } from "lucide-react";
import { useApp } from "@/components/Providers";
import { rng } from "@/lib/pehchaan/sim";
import type { Scored } from "@/lib/pehchaan/model";
import type { Message } from "@/lib/ai";
import { L, favourite, gapText, inr, usePehchaan } from "@/lib/pehchaan/use";
import s from "./winback.module.css";

// Assumed response curve: customers who left recently and were frequent respond best.
const pReturn = (x: Scored) => Math.min(0.6, 0.1 + 0.45 * x.pAlive + 0.15 * Math.min(1, x.rfm.x / 40));

type Step = { text: string; state: "run" | "ok" };

export default function Winback() {
  const { sent, markSent, markReturned, reset, speak, speaking, status } = useApp();
  const { winnable } = usePehchaan();
  const [offer, setOffer] = useState(30);
  const [size, setSize] = useState(8);
  const [msgs, setMsgs] = useState<Record<string, Message>>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const scope = useRef<HTMLDivElement>(null);

  const pool = winnable.filter((x) => !sent[x.c.id]);
  const plan = pool.slice(0, size);
  const campaign = winnable.filter((x) => sent[x.c.id]);
  const returned = campaign.filter((x) => sent[x.c.id].returned);
  const pending = campaign.filter((x) => sent[x.c.id].returned == null);
  const resolved = campaign.length - pending.length;

  const est = useMemo(() => {
    const back = plan.reduce((a, x) => a + pReturn(x), 0);
    const revenue = plan.reduce((a, x) => a + pReturn(x) * x.monthly, 0);
    return { back, revenue, cost: back * offer };
  }, [plan, offer]);

  const body = JSON.stringify({ items: plan.map((x) => ({ id: x.c.id, name: x.c.name, usual: gapText(x.avgGap), lastSeen: Math.round(x.lastSeen), favourite: favourite(x.c.archetype), offer })) });
  // One call writes the whole plan; start it while the owner reviews, so "Run agent" is instant.
  useEffect(() => {
    if (plan.length) fetch("/api/messages", { method: "POST", body }).catch(() => {});
  }, [body, plan.length]);

  const log = (text: string) => setSteps((p) => [...p.map((x) => ({ ...x, state: "ok" as const })), { text, state: "run" }]);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    setRunning(true);
    setSteps([]);
    log(`Selected ${plan.length} customers — highest monthly spend × probability they've left`);
    await wait(700);
    log(status?.gemini ? "Writing a personal message for each, in Kannada (Gemini)" : "Writing a personal message for each, in Kannada");
    const { msgs: written } = await fetch("/api/messages", { method: "POST", body }).then((r) => r.json());
    setMsgs((p) => ({ ...p, ...written }));
    if (plan[0]) setPreview(plan[0].c.id);
    log(`Attaching ₹${offer} store offer, redeemable only at Sri Manjunatha Stores`);
    await wait(700);
    log("Delivering as Paytm app notifications");
    await wait(900);
    markSent(plan.map((x) => x.c.id), offer);
    log(`Sent. Watching the Soundbox for their next payment.`);
    await wait(400);
    setSteps((p) => p.map((x) => ({ ...x, state: "ok" })));
    setRunning(false);
  };

  // Deterministic outcome per customer so the demo is repeatable.
  const simulateWeek = () => {
    pending.forEach((x, i) => {
      const r = rng(parseInt(x.c.id.slice(1)) * 97 + i);
      markReturned(x.c.id, r() < pReturn(x));
    });
  };

  useGSAP(() => {
    if (steps.length) gsap.from(`.${s.steps} li:last-child`, { x: -10, autoAlpha: 0, duration: 0.5, ease: "expo.out" });
  }, { scope, dependencies: [steps.length] });

  const pv = preview ? winnable.find((x) => x.c.id === preview) : null;
  const pm = preview ? msgs[preview] : null;
  const recovered = returned.reduce((a, x) => a + x.monthly, 0);

  return (
    <div className={s.page} ref={scope}>
      <section className={s.kpis}>
        <div className="card" data-in><span className={s.kL}>Ready to win back</span><b className="mono">{pool.length}</b><small>customers who left in the last 90 days</small></div>
        <div className="card" data-in><span className={s.kL}>Offers sent</span><b className="mono">{campaign.length}</b><small>{pending.length} waiting for a visit</small></div>
        <div className="card" data-in><span className={s.kL}>Came back</span><b className={`mono ${s.good}`}>{returned.length}</b><small>{resolved ? `${Math.round((returned.length / resolved) * 100)}% of resolved offers` : "—"}</small></div>
        <div className="card" data-in><span className={s.kL}>Monthly spend recovered</span><b className={`mono ${s.good}`}>{L(recovered)}</b><small>for ₹{returned.reduce((a, x) => a + (sent[x.c.id]?.offer ?? 0), 0)} in offers</small></div>
      </section>

      <section className={s.grid}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">This week&apos;s plan</div>
              <div className="card-sub">The agent picks who to bring back. You only approve.</div>
            </div>
            {campaign.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { reset(); setSteps([]); setMsgs({}); }}><RotateCcw size={13} />Reset</button>}
          </div>
          <div className={s.controls}>
            <label>Offer per customer
              <div className="seg">{[20, 30, 50].map((v) => <button key={v} aria-pressed={offer === v} onClick={() => setOffer(v)}>₹{v}</button>)}</div>
            </label>
            <label>Customers
              <div className="seg">{[5, 8, 12].map((v) => <button key={v} aria-pressed={size === v} onClick={() => setSize(v)}>{v}</button>)}</div>
            </label>
            <div className={s.est}>
              <span><small>Expected to return</small><b className="mono">{est.back.toFixed(1)}</b></span>
              <span><small>Monthly spend back</small><b className="mono">{L(est.revenue)}</b></span>
              <span><small>Offer cost</small><b className="mono">{inr(est.cost)}</b></span>
            </div>
          </div>
          <div className={s.list}>
            {plan.map((x) => (
              <button key={x.c.id} className={`${s.row} ${preview === x.c.id ? s.rowOn : ""}`} onClick={() => setPreview(x.c.id)}>
                <span className={s.av}>{x.c.name.split(" ").map((p) => p[0]).join("")}</span>
                <span className={s.who}><b>{x.c.name}</b><small>{gapText(x.avgGap)} · last seen {Math.round(x.lastSeen)}d ago</small></span>
                <span className="mono t2">{inr(x.monthly)}/mo</span>
                <span className={s.p}><i><b style={{ width: `${pReturn(x) * 100}%` }} /></i><span className="mono">{Math.round(pReturn(x) * 100)}%</span></span>
                {msgs[x.c.id] ? <Check size={15} className={s.ok} /> : <CircleDashed size={15} className="t3" />}
              </button>
            ))}
            {plan.length === 0 && <p className={s.empty}>Everyone who&apos;s winnable already has an offer. Check results below.</p>}
          </div>
          <div className={s.runBar}>
            <span className="t3">Return likelihood is an assumed response curve, not a trained model — it gets replaced by real redemption data after the first campaigns.</span>
            <button className="btn btn-primary" onClick={run} disabled={running || plan.length === 0}>{running ? <Loader2 size={14} className={s.spin} /> : <Send size={14} />}Run agent</button>
          </div>
        </div>

        <div className={s.side}>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Agent</div>{running ? <span className="badge badge-info"><Loader2 className={s.spin} />Working</span> : <span className="badge"><Bot />Idle</span>}</div>
            <ol className={s.steps}>
              {steps.length === 0 && <li className={s.idle}>Press <b>Run agent</b> to send this week&apos;s offers.</li>}
              {steps.map((st, i) => (
                <li key={i}><span className={st.state === "ok" ? s.dotOk : s.dotRun}>{st.state === "ok" ? <Check size={11} /> : <Loader2 size={11} className={s.spin} />}</span>{st.text}</li>
              ))}
            </ol>
          </div>

          <div className={`card ${s.phone}`} data-in>
            <div className={s.notif}>
              <div className={s.nHead}><span className={s.pIcon}>P</span><b>Paytm</b><small>now</small></div>
              {pv ? (
                <>
                  <b className={s.nTitle}>Sri Manjunatha Stores · ₹{offer} off for you</b>
                  {pm ? <p className="kn">{pm.kn}</p> : <span className="skeleton" style={{ display: "block", height: 54 }} />}
                  {pm && <p className={s.nEn}>{pm.en}</p>}
                </>
              ) : (
                <p className={s.nEn}><Sparkles size={13} /> Messages appear here once the agent writes them.</p>
              )}
            </div>
            {pm && <button className="btn btn-secondary btn-sm" disabled={speaking} onClick={() => speak(pm.kn, pm.en)}><Play size={13} />{speaking ? "Speaking…" : "Hear it"}</button>}
          </div>
        </div>
      </section>

      {campaign.length > 0 && (
        <section className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Results</div>
              <div className="card-sub">A returning customer is detected the moment they pay at the Soundbox</div>
            </div>
            {pending.length > 0 && <button className="btn btn-secondary btn-sm" onClick={simulateWeek}>Simulate the next 7 days</button>}
          </div>
          <div className={s.results}>
            {campaign.map((x) => {
              const st = sent[x.c.id];
              return (
                <div key={x.c.id} className={s.res}>
                  <b>{x.c.name}</b>
                  <span className="t3">₹{st.offer} offer</span>
                  {st.returned == null ? <span className="badge">Waiting</span> : st.returned ? <span className="badge badge-good">Came back · {inr(x.monthly)}/mo</span> : <span className="badge badge-bad">No visit</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
