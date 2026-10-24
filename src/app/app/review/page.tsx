"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dMedium } from "@/lib/format";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Check, Mic, RotateCcw, Volume2 } from "lucide-react";
import { CountUp } from "@/components/motion";
import { useApp } from "@/components/Providers";
import type { Txn } from "@/lib/data";
import type { Question } from "@/lib/ai";
import { inr } from "@/lib/gst";
import { L, useLedger } from "@/lib/useLedger";
import s from "./review.module.css";

const fmtDate = dMedium;

export default function Review() {
  const { answers, answer, reset, speak, speaking, status } = useApp();
  const { txns, prevSum, sum, fyKey } = useLedger();
  const queue = useMemo(() => txns.filter((t) => t.cls === "review"), [txns]);
  const pending = queue.filter((t) => !answers[t.id]);
  const current: Txn | undefined = pending[0];
  const [qs, setQs] = useState<Record<string, Question>>({});
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const scope = useRef<HTMLDivElement>(null);

  // Warm every question as soon as the page opens; slow ones land while the merchant answers earlier ones.
  useEffect(() => {
    // A template comes back when Gemini is slow; the call keeps running server-side, so ask once more later.
    const load = (t: Txn, retry: boolean) =>
      fetch("/api/question", { method: "POST", body: JSON.stringify({ payer: t.payer, amount: t.amount, date: fmtDate(t.date), note: t.note, reason: t.reason }) })
        .then((r) => r.json())
        .then(({ q, source }) => {
          setQs((p) => ({ ...p, [t.id]: q }));
          if (retry && source === "template" && status?.gemini) setTimeout(() => load(t, false), 15_000);
        });
    queue.forEach((t) => load(t, true));
  }, [queue, status?.gemini]);

  useGSAP(() => {
    if (card.current) gsap.fromTo(card.current, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "expo.out" });
  }, { dependencies: [current?.id], scope });

  useGSAP(() => {
    gsap.killTweensOf(`.${s.wave} i`);
    if (speaking || recording) gsap.to(`.${s.wave} i`, { scaleY: () => 0.25 + Math.random() * 1.5, duration: 0.16, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: { each: 0.03, repeatRefresh: true } });
    else gsap.to(`.${s.wave} i`, { scaleY: 0.2, duration: 0.4 });
  }, { dependencies: [speaking, recording], scope });

  const decide = (cls: "sale" | "personal") => {
    if (!current) return;
    setHeard(null);
    gsap.to(card.current, { x: cls === "sale" ? -40 : 40, autoAlpha: 0, duration: 0.35, ease: "power3.in", onComplete: () => answer(current.id, cls) });
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const fd = new FormData();
        fd.append("file", new Blob(chunks, { type: mr.mimeType }));
        fd.append("lang", "kn-IN");
        const res = await fetch("/api/stt", { method: "POST", body: fd }).then((r) => r.json());
        setHeard(res.transcript ?? "Couldn't catch that — tap an answer.");
        if (res.cls) setTimeout(() => decide(res.cls), 900);
      };
      rec.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setHeard("Microphone not available — tap an answer.");
    }
  };
  const stopRec = () => { rec.current?.stop(); setRecording(false); };
  const q = current ? qs[current.id] : undefined;
  const done = queue.length - pending.length;

  return (
    <div className={s.grid} ref={scope}>
      <div className={s.left}>
        <div className={`card ${s.progress}`} data-in>
          <div>
            <span className={s.kLabel}>Resolved</span>
            <span className={`mono ${s.kVal}`}>{done}<span className="t3">/{queue.length}</span></span>
          </div>
          <div className={s.bar}><span style={{ width: `${(done / queue.length) * 100}%` }} /></div>
          <div className={s.live}>
            <div><span className={s.kLabel}>Business · FY 25–26</span><span className="mono"><CountUp value={prevSum.business} format={L} /></span></div>
            <div><span className={s.kLabel}>Business · {fyKey === "curr" ? "FY 26–27 YTD" : "FY 25–26"}</span><span className="mono"><CountUp value={sum.business} format={L} /></span></div>
          </div>
        </div>

        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Low-confidence credits</div>
              <div className="card-sub">Kavach never guesses on these — it asks.</div>
            </div>
            {done > 0 && <button className="btn btn-ghost btn-sm" onClick={reset}><RotateCcw size={13} />Reset</button>}
          </div>
          <div className={s.list}>
            {queue.map((t) => {
              const a = answers[t.id];
              const now = t.id === current?.id;
              return (
                <div key={t.id} className={`${s.item} ${now ? s.now : ""} ${a ? s.done : ""}`}>
                  <span className={s.check}>{a ? <Check size={12} /> : now ? <span className={s.pulse} /> : null}</span>
                  <span className={s.who}><b>{t.payer}</b><small>{fmtDate(t.date)} · {t.vpa}</small></span>
                  <span className="mono">{inr(t.amount)}</span>
                  <span>{a ? <span className={`badge ${a === "sale" ? "" : ""}`}><span className="sw" style={{ background: a === "sale" ? "var(--c-sale)" : "var(--c-personal)" }} />{a === "sale" ? "Sale" : "Personal"}</span> : now ? <span className="badge badge-info">Asking</span> : <span className="badge">Queued</span>}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={s.right} data-in>
        <div className={s.device}>
          <div className={s.dTop}>
            <span className={s.brand}>paytm <b>soundbox</b></span>
            <span className={`${s.led} ${speaking || recording ? s.ledOn : ""}`} />
          </div>
          <div className={s.screen}>
            {current ? (
              <div ref={card} key={current.id} className={s.cardIn}>
                <div className={s.cHead}><span>Kavach asks</span><span className="mono">{Math.round(current.confidence * 100)}% sure</span></div>
                <div className={s.amount}><span className="mono">{inr(current.amount)}</span><small>{current.payer} · {fmtDate(current.date)}</small></div>
                <p className={`kn ${s.knq}`}>{q?.kn ?? <span className="skeleton" style={{ display: "block", height: 60 }} />}</p>
                <p className={s.en}>{q?.en}</p>
                <div className={s.wave} aria-hidden>{Array.from({ length: 32 }, (_, i) => <i key={i} />)}</div>
                <div className={s.actions}>
                  <button className="btn btn-secondary" disabled={!q || speaking} onClick={() => q && speak(q.kn, q.en)}><Volume2 size={15} />{speaking ? "Speaking…" : "Ask aloud"}</button>
                  {status?.sarvam && (
                    <button className={`btn btn-secondary ${recording ? s.rec : ""}`} onPointerDown={startRec} onPointerUp={stopRec} onPointerLeave={() => recording && stopRec()}>
                      <Mic size={15} />{recording ? "Listening…" : "Hold to answer"}
                    </button>
                  )}
                </div>
                {heard && <p className={s.heard}>Heard: <span className="kn">“{heard}”</span></p>}
                <div className={s.answers}>
                  <button onClick={() => decide("sale")}><span className="kn">ವ್ಯಾಪಾರ</span><b>Shop sale</b></button>
                  <button onClick={() => decide("personal")}><span className="kn">ಮನೆ / ಸ್ನೇಹಿತರು</span><b>Personal money</b></button>
                </div>
                <p className={s.why}>{q?.why}</p>
              </div>
            ) : (
              <div className={s.allDone}>
                <span className={s.doneIcon}><Check size={22} /></span>
                <b>All clear</b>
                <p className="kn">ಎಲ್ಲಾ ಲೆಕ್ಕ ಸರಿಯಾಗಿದೆ.</p>
                <p className="t3">Every credit is sorted and backed by a reason.</p>
              </div>
            )}
          </div>
          <div className={s.grille} aria-hidden>{Array.from({ length: 60 }, (_, i) => <i key={i} />)}</div>
        </div>
      </div>
    </div>
  );
}
