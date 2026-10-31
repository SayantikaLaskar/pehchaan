"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useApp } from "./Providers";
import { codeOf } from "@/lib/pehchaan/i18n";
import { QUESTIONS, answer, intentOf, type Intent } from "@/lib/pehchaan/ask";
import { useLive } from "@/lib/pehchaan/use";
import s from "./ask.module.css";

/** Talk to the Soundbox: tap the mic (Sarvam speech-to-text) or a suggested question. */
export function AskSoundbox({ dark = false }: { dark?: boolean }) {
  const { lang, speak, speaking, status, sent } = useApp();
  const live = useLive();
  const [heard, setHeard] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [rec, setRec] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);

  const respond = (q: string, intent: Intent = intentOf(q)) => {
    setHeard(q);
    const say = answer(intent, {
      winnable: live.winnable, scored: live.scored, expectedToday: live.expectedToday,
      sentCount: Object.keys(sent).length, backCount: Object.values(sent).filter((v) => v.returned).length,
    });
    setReply(say[lang]);
    speak(say);
  };

  const toggle = async () => {
    if (rec) { mr.current?.stop(); setRec(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      m.ondataavailable = (e) => chunks.push(e.data);
      m.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setHeard("…");
        const fd = new FormData();
        fd.append("file", new Blob(chunks, { type: m.mimeType }));
        fd.append("lang", codeOf(lang));
        const { transcript } = await fetch("/api/stt", { method: "POST", body: fd }).then((r) => r.json());
        if (transcript) respond(transcript);
        else setHeard("Couldn't hear that — tap a question instead.");
      };
      mr.current = m;
      m.start();
      setRec(true);
    } catch {
      setHeard("Microphone not available — tap a question instead.");
    }
  };

  return (
    <div className={`${s.box} ${dark ? s.dark : ""}`}>
      <div className={s.row}>
        {status?.sarvam && (
          <button className={`${s.mic} ${rec ? s.on : ""}`} onClick={toggle} aria-label={rec ? "Stop recording" : "Ask by voice"}>
            {rec ? <Square size={16} /> : <Mic size={18} />}
          </button>
        )}
        <div className={s.chips}>
          {(Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).map((k) => (
            <button key={k} disabled={speaking} onClick={() => respond(QUESTIONS[k][lang], k)} className={lang === "kn" ? "kn" : ""}>{QUESTIONS[k][lang]}</button>
          ))}
        </div>
      </div>
      {heard && <p className={s.heard}><span>You</span><span className={lang === "kn" ? "kn" : ""}>{heard}</span></p>}
      {reply && <p className={s.reply}><span>Soundbox</span><span className={lang === "kn" ? "kn" : ""}>{reply}</span></p>}
    </div>
  );
}
