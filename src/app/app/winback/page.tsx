"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { post } from "@/lib/outbox";
import { SoundListener } from "@/components/SoundListener";
import { offerText } from "@/lib/pehchaan/i18n";
import { merchantWa } from "@/lib/pehchaan/orders";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Bot, BrainCircuit, Check, CircleDashed, Loader2, Play, RotateCcw, Send, Sparkles } from "lucide-react";
import { useApp } from "@/components/Providers";
import { rng } from "@/lib/pehchaan/sim";
import type { Scored } from "@/lib/pehchaan/model";
import type { Message } from "@/lib/ai";
import { llmPayload } from "@/lib/pehchaan/consent";
import { ARMS, arms, pick } from "@/lib/pehchaan/bandit";
import { L, favourite, gapText, inr, useLive } from "@/lib/pehchaan/use";
import s from "./winback.module.css";

const MARGIN = 0.15; // kirana gross margin on recovered spend
const WEEK_SEED = 202644; // this week's Thompson draw — stable across reloads
const valueOf = (xs: Scored[]) => (xs.slice(0, 8).reduce((a, x) => a + x.monthly, 0) / Math.max(1, Math.min(8, xs.length))) * MARGIN;

type Step = { text: string; state: "run" | "ok" };

export default function Winback() {
  const { sent, markSent, markReturned, reset, speak, speaking, status, lang } = useApp();
  const { winnable, eligible } = useLive();
  const [offer, setOffer] = useState<number>(() => { const v = valueOf(eligible); return pick(arms([], v), v, WEEK_SEED); });
  const [size, setSize] = useState(8);
  const [msgs, setMsgs] = useState<Record<string, Message>>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const scope = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  // Only opted-in customers, and nobody who already got an offer this month.
  const pool = eligible.filter((x) => !sent[x.c.id]);
  const noConsent = winnable.filter((x) => !sent[x.c.id]).length - pool.length;
  const plan = pool.slice(0, size);
  const campaign = winnable.filter((x) => sent[x.c.id]);
  const returned = campaign.filter((x) => sent[x.c.id].returned);
  const pending = campaign.filter((x) => sent[x.c.id].returned == null);
  const resolved = campaign.length - pending.length;

  // What the agent has learned about each offer size, from history plus every resolved offer.
  const value = valueOf(pool.length ? pool : eligible);
  const outcomes = Object.values(sent).filter((v) => v.returned != null).map((v) => ({ offer: v.offer, returned: !!v.returned }));
  const states = useMemo(() => arms(outcomes, value), [JSON.stringify(outcomes), value]); // eslint-disable-line react-hooks/exhaustive-deps
  const agentPick = useMemo(() => pick(states, value, WEEK_SEED + outcomes.length), [states, value, outcomes.length]);
  const rate = states.find((a) => a.arm === offer)?.mean ?? 0.25;
  // Learned redemption rate for this offer, scaled by how recently the customer was still a regular.
  const pReturn = (x: Scored) => Math.min(0.9, rate * (0.5 + x.pAlive));

  const est = useMemo(() => {
    const back = plan.reduce((a, x) => a + pReturn(x), 0);
    const revenue = plan.reduce((a, x) => a + pReturn(x) * x.monthly, 0);
    return { back, revenue, cost: back * offer };
  }, [plan, offer, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = JSON.stringify({ items: plan.map((x) => ({ id: x.c.id, ...llmPayload(x.c.name.split(" ")[0], gapText(x.avgGap), Math.round(x.lastSeen), favourite(x.c.archetype), offer) })) });
  // One call writes the whole plan; start it while the owner reviews, so "Run agent" is instant.
  useEffect(() => {
    if (plan.length) fetch("/api/messages", { method: "POST", body }).catch(() => {});
  }, [body, plan.length]);

  // Each offer visibly leaves its row and lands in the phone.
  const flyOut = () => {
    const target = scope.current?.querySelector(`.${s.notif}`)?.getBoundingClientRect();
    if (!target) return;
    scope.current!.querySelectorAll<HTMLElement>(`.${s.row}`).forEach((row, i) => {
      const r = row.getBoundingClientRect();
      const chip = document.createElement("div");
      chip.className = s.flyer;
      chip.textContent = `₹${offer}`;
      document.body.appendChild(chip);
      gsap.set(chip, { left: r.left + 16, top: r.top + r.height / 2 - 14 });
      gsap.timeline({ delay: i * 0.09, onComplete: () => chip.remove() })
        .from(chip, { scale: 0, duration: 0.25, ease: "back.out(3)" })
        .to(chip, { left: target.left + target.width / 2 - 24, top: target.top + 24, duration: 0.8, ease: "power2.inOut" })
        .to(chip, { scale: 0.3, autoAlpha: 0, duration: 0.25 }, "-=0.1");
    });
    gsap.fromTo(scope.current!.querySelector(`.${s.notif}`), { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 3, delay: 0.9, ease: "power1.inOut" });
  };

  const log = (text: string) => setSteps((p) => [...p.map((x) => ({ ...x, state: "ok" as const })), { text, state: "run" }]);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    setRunning(true);
    setSteps([]);
    log(`Selected ${plan.length} customers — highest monthly spend × probability they've left`);
    await wait(700);
    log(status?.gemini ? "Writing a personal message for each, in Kannada (Gemini)" : "Writing a personal message for each, in Kannada");
    const { msgs: got } = (await fetch("/api/messages", { method: "POST", body }).then((r) => r.json()).catch(() => ({ msgs: {} }))) as { msgs: Record<string, Message> };
    // Offline: the same Kannada / Hindi / English templates the server falls back to.
    const written: Record<string, Message> = Object.fromEntries(plan.map((x) => [x.c.id, got[x.c.id] ?? offerText(x.c.name.split(" ")[0], offer)]));
    setMsgs((p) => ({ ...p, ...written }));
    if (plan[0]) setPreview(plan[0].c.id);
    log(`Attaching ₹${offer} store offer, redeemable only at Sri Manjunatha Stores`);
    await wait(700);
    log("Delivering as Paytm app notifications");
    flyOut();
    // Codes are minted here, so the QR works even if the network drops mid-send; the outbox syncs it later.
    const mint = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(6)))).replace(/\+/g, "-").replace(/\//g, "_").slice(0, 6);
    const items = plan.map((x) => ({ id: x.c.id, code: mint(), first: x.c.name.split(" ")[0], kn: written[x.c.id]?.kn ?? "", hi: written[x.c.id]?.hi ?? "", en: written[x.c.id]?.en ?? "", lang, offer }));
    const codes = Object.fromEntries(items.map((it) => [it.id, it.code]));
    const res = await post("/api/offers", { items });
    if (!res) log("No network — offers saved on this device, they'll send when it's back");
    await wait(900);
    markSent(plan.map((x) => x.c.id), offer, Object.fromEntries(plan.map((x) => [x.c.id, `P(regular) ${Math.round(x.pAlive * 100)}% (was ${Math.round(x.pAlive30 * 100)}%), ${Math.round(x.lastSeen)}d since last visit`])), codes);
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
  const code = pv ? sent[pv.c.id]?.code : undefined;
  const pm = preview ? msgs[preview] : null;
  useEffect(() => {
    if (!code) { setQr(null); return; }
    // The link carries the offer too, so the phone page works even if another server answers.
    // Keep it short so the QR stays scannable: id, first name, offer, language (~100 chars total).
    const d = pv ? btoa(unescape(encodeURIComponent(JSON.stringify({ i: pv.c.id, f: pv.c.name.split(" ")[0], o: sent[pv.c.id]?.offer ?? offer, l: lang, ...(merchantWa() ? { w: merchantWa() } : {}) })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
    const url = `${window.location.origin}/o/${code}${d ? `?d=${d}` : ""}`;
    setLink(url);
    QRCode.toDataURL(url, { margin: 2, width: 480, errorCorrectionLevel: "M", color: { dark: "#06132b", light: "#ffffff" } }).then(setQr);
  }, [code, msgs]); // eslint-disable-line react-hooks/exhaustive-deps
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
              <div className="seg">{ARMS.map((v) => <button key={v} aria-pressed={offer === v} onClick={() => setOffer(v)}>₹{v}{v === agentPick ? " ★" : ""}</button>)}</div>
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
            <span className="t3">{noConsent > 0 && <><b>{noConsent} skipped</b> — not opted in to offers. </>}Return likelihood = learned redemption rate for ₹{offer} × the customer&apos;s recency. ★ marks the agent&apos;s pick.</span>
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
                  {pm ? <p className="kn">{pm[lang] || pm.en}</p> : <span className="skeleton" style={{ display: "block", height: 54 }} />}
                  {pm && lang !== "en" && <p className={s.nEn}>{pm.en}</p>}
                </>
              ) : (
                <p className={s.nEn}><Sparkles size={13} /> Messages appear here once the agent writes them.</p>
              )}
            </div>
            {pm && <button className="btn btn-secondary btn-sm" disabled={speaking} onClick={() => speak(pm)}><Play size={13} />{speaking ? "Speaking…" : "Hear it"}</button>}
            {qr && pv && sent[pv.c.id]?.returned == null && (
              <div className={`${s.qr} ${sent[pv.c.id]?.openedAt ? s.qrOpened : ""}`}>
                <div className={s.qrFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`QR code for ${pv.c.name}'s offer`} />
                  <i className={s.laser} /><i className={`${s.corner} ${s.c1}`} /><i className={`${s.corner} ${s.c2}`} /><i className={`${s.corner} ${s.c3}`} /><i className={`${s.corner} ${s.c4}`} />
                </div>
                <span>
                  {sent[pv.c.id]?.openedAt
                    ? <><b className={s.live}><i />Opened on a phone</b><small>Waiting for {pv.c.name.split(" ")[0]} to redeem…</small></>
                    : <><b>Be {pv.c.name.split(" ")[0]} — scan to get the offer</b><small>Redeem on your phone and watch this dashboard</small></>}
                  {link && <a href={link} target="_blank" rel="noreferrer" className={s.olink}>Open offer link ↗</a>}
                </span>
              </div>
            )}
            {Object.values(sent).some((x) => x.code && x.returned == null) && (
              <div className={s.zero}><span>Zero bars? The customer taps <b>Redeem by sound</b> on their phone; this device hears it.</span><SoundListener /></div>
            )}
          </div>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">What the agent has learned about offers</div>
            <div className="card-sub">Thompson sampling over offer sizes · {states.reduce((a, x) => a + x.s + x.f - 2, 0)} offers so far (earlier campaigns + this demo) · a won-back regular is worth ≈ {inr(value)}/month in margin</div>
          </div>
          <span className="badge badge-info"><BrainCircuit />Picks ₹{agentPick} this week</span>
        </div>
        <div className={s.arms}>
          {states.map((a) => (
            <div key={a.arm} className={`${s.arm} ${a.arm === agentPick ? s.armOn : ""}`}>
              <b className="mono">₹{a.arm}</b>
              <div className={s.track}>
                <span className={s.range} style={{ left: `${a.lo * 100}%`, width: `${(a.hi - a.lo) * 100}%` }} />
                <span className={s.mean} style={{ left: `${a.mean * 100}%` }} />
              </div>
              <span className="mono">{Math.round(a.mean * 100)}% <small>({Math.round(a.lo * 100)}–{Math.round(a.hi * 100)}%)</small></span>
              <span className="mono">{a.s + a.f - 2} sent</span>
              <span className={`mono ${a.profit >= 0 ? s.good : ""}`}>{a.profit >= 0 ? "+" : "−"}{inr(Math.abs(a.profit))}/offer</span>
            </div>
          ))}
          <p className={s.armNote}>Bar = 90% credible range of the redemption rate; dot = best estimate. Every redemption — including from a customer&apos;s phone — narrows these, and the agent shifts toward the most profitable offer while still exploring.</p>
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
