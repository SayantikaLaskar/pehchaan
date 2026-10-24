"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, Check, Copy, FileUp, Loader2, Play, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/Providers";
import { FY_PREV } from "@/lib/data";
import { THRESHOLD, inr, summarize } from "@/lib/gst";
import { L, useLedger } from "@/lib/useLedger";
import type { Notice, Recon, Reply } from "@/lib/ai";
import s from "./notices.module.css";

type Phase = "idle" | "reading" | "done";
type Step = { label: string; detail?: string; state: "wait" | "run" | "ok" };

async function shrink(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * k;
  c.height = img.height * k;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL("image/jpeg", 0.88).split(",")[1], url };
}

const STEPS = ["Read the notice", "Match UPI credits", "Separate non-business money", "Check exempt supplies", "Draft the reply"];

export default function Notices() {
  const { speak, speaking } = useApp();
  const { txns, purchases, answers } = useLedger();
  const sum = summarize(txns, purchases, FY_PREV, answers);
  const R = Math.round;
  const recon: Recon = {
    gross: R(sum.gross), business: R(sum.business), exempt: R(sum.exempt), taxable: R(sum.taxable),
    personal: R(sum.by.personal), loan: R(sum.by.loan), own: R(sum.by.own), refund: R(sum.by.refund),
    threshold: THRESHOLD, exemptShare: Math.round(sum.mix.exemptShare * 100) / 100, purchaseCount: sum.mix.n,
  };

  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [source, setSource] = useState("");
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scope = useRef<HTMLDivElement>(null);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const mark = (i: number, state: Step["state"], detail?: string) =>
    setSteps((p) => p.map((x, j) => (j === i ? { ...x, state, detail: detail ?? x.detail } : x)));

  // Start drafting the sample reply in the background so the stage demo is instant.
  const warm = useRef(false);
  useEffect(() => {
    if (warm.current) return;
    warm.current = true;
    fetch("/api/reply", { method: "POST", body: JSON.stringify({ sample: true, recon }) }).catch(() => {});
  });

  const run = async (file?: File) => {
    setPhase("reading");
    setReply(null);
    setSteps(STEPS.map((label) => ({ label, state: "wait" })));
    let body: Record<string, unknown> = { sample: true };
    if (file) {
      const img = await shrink(file);
      setPreview(img.url);
      body = { image: img.data, mediaType: "image/jpeg" };
    } else setPreview("/sample-notice.png");

    mark(0, "run");
    const nP = fetch("/api/notice", { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
    await wait(900);
    const { notice: n } = await nP;
    setNotice(n);
    mark(0, "ok", `${n.reference} · demand ${inr(n.total)}`);
    mark(1, "run");
    const rP = fetch("/api/reply", { method: "POST", body: JSON.stringify({ notice: n, recon }) }).then((r) => r.json());
    await wait(800);
    mark(1, "ok", `${sum.payments.toLocaleString("en-IN")} credits in ${FY_PREV.label}`);
    mark(2, "run");
    await wait(700);
    mark(2, "ok", `${L(sum.nonBusiness)} set aside — family, loans, own, refunds`);
    mark(3, "run");
    await wait(600);
    mark(3, "ok", `${Math.round(sum.mix.exemptShare * 100)}% fresh produce · from ${sum.mix.n} supplier payments`);
    mark(4, "run");
    const { reply: r, source: src } = await rP;
    setReply(r);
    setSource(src);
    mark(4, "ok", src === "gemini" ? "Written by Gemini" : "Template");
    await wait(500);
    setPhase("done");
  };

  useGSAP(() => {
    if (phase === "reading") gsap.fromTo(`.${s.scan}`, { top: "4%" }, { top: "96%", duration: 1.5, ease: "sine.inOut", repeat: -1, yoyo: true });
    if (phase !== "done" || !notice) return;
    const o = { v: notice.total };
    const due = scope.current!.querySelector(`.${s.due}`);
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(`.${s.result} > *`, { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.08 })
      .fromTo(`.${s.strike}`, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, 0.5)
      .to(o, { v: 0, duration: 1.6, onUpdate: () => { if (due) due.textContent = inr(o.v); } }, 0.9)
      .from(`.${s.wfBar}`, { scaleX: 0, transformOrigin: "0 50%", duration: 1, stagger: 0.1 }, 0.9);
  }, { scope, dependencies: [phase] });

  const printLetter = () => {
    if (!reply) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${reply.subject}</title><style>body{font:15px/1.65 Georgia,serif;max-width:680px;margin:64px auto;padding:0 24px;color:#111}h1{font:600 15px system-ui;margin-bottom:28px}p{white-space:pre-wrap;margin:0 0 14px}.n{margin-top:40px;font:12px system-ui;color:#777;border-top:1px solid #ddd;padding-top:12px}</style></head><body><h1>${reply.subject}</h1>${reply.body.split("\n\n").map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`).join("")}<div class="n">Enclosures: bank statement (${FY_PREV.label}), lender disbursal letters, Kavach reconciliation report. Draft prepared with Hisaab Kavach — review with a CA / GST practitioner before filing.</div><script>print()</script></body></html>`);
    w.document.close();
  };

  const wf = [
    { k: "UPI credits", v: sum.gross, kind: "base" },
    { k: "Family & friends", v: -sum.by.personal, kind: "minus" },
    { k: "Loan disbursals", v: -sum.by.loan, kind: "minus" },
    { k: "Own money (self, chit)", v: -sum.by.own, kind: "minus" },
    { k: "Refunds & reversals", v: -sum.by.refund, kind: "minus" },
    { k: "True aggregate turnover", v: sum.business, kind: "total" },
  ];
  let cursor = sum.gross;

  return (
    <div ref={scope} className={s.page}>
      {phase !== "done" && (
        <>
          <div className={`card ${s.list}`} data-in>
            <div className="card-head">
              <div className="card-title">Notices</div>
              <span className="card-sub">Keep every notice and reply in one place</span>
            </div>
            <div className={s.nTable}>
              <div className={s.nHead}><span>Reference</span><span>Issued by</span><span>Period</span><span>Demand</span><span>Reply by</span><span>Status</span><span /></div>
              <div className={s.nRow}>
                <span className="mono">ASMT-10/08817</span>
                <span>Asst. Commissioner, DVO-14</span>
                <span>{FY_PREV.label}</span>
                <span className="mono">₹7,71,150</span>
                <span>11 Nov 2026</span>
                <span><span className="badge badge-warn">Open</span></span>
                <span><button className="btn btn-secondary btn-sm" onClick={() => run()} disabled={phase === "reading"}>Analyse</button></span>
              </div>
            </div>
          </div>

          <div className={s.stage}>
            <div
              className={`card ${s.drop} ${drag ? s.dragOn : ""}`}
              data-in
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) run(f); }}
              onClick={() => phase === "idle" && fileRef.current?.click()}
            >
              {preview ? (
                <div className={s.previewWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Notice" className={s.preview} />
                  <span className={s.scan} />
                </div>
              ) : (
                <div className={s.dropInner}>
                  <span className={s.dropIcon}><FileUp size={22} /></span>
                  <b>Drop a photo of a new notice</b>
                  <span className="t3">JPG or PNG · Kannada, Hindi or English · read by Gemini</span>
                  <span className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>Choose file</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); }} />
            </div>

            <div className={`card ${s.pipeline}`} data-in>
              <div className="card-head">
                <div className="card-title">{phase === "idle" ? "How the shield works" : "Kavach is working"}</div>
                {phase === "reading" && <span className="badge badge-info"><Loader2 className={s.spin} />Running</span>}
              </div>
              <ol className={s.steps}>
                {(steps.length ? steps : STEPS.map((label) => ({ label, state: "wait" as const, detail: undefined }))).map((st, i) => (
                  <li key={st.label} className={s[st.state]}>
                    <span className={s.stepIcon}>{st.state === "ok" ? <Check size={13} /> : st.state === "run" ? <Loader2 size={13} className={s.spin} /> : i + 1}</span>
                    <span><b>{st.label}</b>{st.detail && <small>{st.detail}</small>}</span>
                  </li>
                ))}
              </ol>
              {phase === "idle" && (
                <div className={s.pipeFoot}>
                  <button className="btn btn-primary" onClick={() => run()}>Try with sample notice</button>
                  <Link href="/notice-sample" target="_blank" className="btn btn-ghost">Printable sample <ArrowUpRight size={14} /></Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {phase === "done" && notice && reply && (
        <div className={s.result}>
          <div className={`card ${s.verdict}`}>
            <div className={s.vCol}>
              <span className={s.kLabel}>Demanded · {notice.reference}</span>
              <span className={`mono ${s.demand}`}>{inr(notice.total)}<i className={s.strike} /></span>
              <span className="t3">on alleged turnover of {L(notice.turnoverAlleged)}</span>
            </div>
            <div className={s.vCol}>
              <span className={s.kLabel}>Actually due</span>
              <span className={`mono ${s.due}`}>{inr(notice.total)}</span>
              <span className="t3">{sum.belowThreshold ? "Not liable to register" : `Composition ≈ ${inr(sum.compositionTax)}`}</span>
            </div>
            <div className={s.vNote}>
              <span className="badge badge-good"><ShieldCheck />Defensible</span>
              <p>
                {sum.belowThreshold ? <>True turnover is <b>{L(sum.business)}</b> — below the ₹40L limit under Section 22. The demand counted family money, loans and refunds as sales.</> : <>True turnover is {L(sum.business)}.</>}
              </p>
              <div className={s.vActions}>
                <button className="btn btn-primary" disabled={speaking} onClick={() => speak(reply.merchantSummaryKn, reply.merchantSummaryEn)}><Play size={14} />{speaking ? "Speaking…" : "Explain to Manjunath"}</button>
                <button className="btn btn-secondary" onClick={() => { setPhase("idle"); setPreview(null); setNotice(null); setSteps([]); }}><RotateCcw size={14} />New notice</button>
              </div>
            </div>
          </div>

          <div className={s.two}>
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Reconciliation · {FY_PREV.label}</div>
                  <div className="card-sub">From what the notice saw to what he actually sold</div>
                </div>
              </div>
              <div className="card-body">
                <div className={s.wf}>
                  {wf.map((st) => {
                    const w = (Math.abs(st.v) / sum.gross) * 100;
                    let left = 0;
                    if (st.kind === "minus") { cursor += st.v; left = (cursor / sum.gross) * 100; }
                    return (
                      <div key={st.k} className={`${s.wfRow} ${s[st.kind]}`}>
                        <span className={s.wfLabel}>{st.k}</span>
                        <span className={s.wfTrack}>
                          <span className={s.wfBar} style={{ left: `${left}%`, width: `${w}%` }} />
                          {st.kind === "total" && <span className={s.wfLimit} style={{ left: `${(THRESHOLD / sum.gross) * 100}%` }}><b>₹40L</b></span>}
                        </span>
                        <span className="mono">{st.v < 0 ? "−" : ""}{L(Math.abs(st.v))}</span>
                      </div>
                    );
                  })}
                </div>
                <p className={s.wfFoot}>Of {L(sum.business)}, {Math.round(sum.mix.exemptShare * 100)}% is fresh produce (nil-rated). Taxable sales: <span className="mono">{L(sum.taxable)}</span>.</p>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><div className="card-title">Grounds of reply</div></div>
              <div className="card-body">
                <ol className={s.grounds}>
                  {reply.grounds.map((g, i) => (
                    <li key={g.title}><span className="mono">{String(i + 1).padStart(2, "0")}</span><span><b>{g.title}</b><small>{g.detail}</small></span></li>
                  ))}
                </ol>
                <div className={s.knBox}>
                  <span className={s.kLabel}>For Manjunath · ಕನ್ನಡ</span>
                  <p className="kn">{reply.merchantSummaryKn}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Draft reply</div>
                <div className="card-sub">{source === "gemini" ? "Written by Gemini" : "Template"} · review with a CA before filing · not legal advice</div>
              </div>
              <div className={s.vActions}>
                <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(reply.body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
                <button className="btn btn-primary btn-sm" onClick={printLetter}><Printer size={14} />Print / PDF</button>
              </div>
            </div>
            <div className="card-body">
              <article className={s.letter}>
                <h3>{reply.subject}</h3>
                {reply.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
