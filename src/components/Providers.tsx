"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Answers } from "@/lib/gst";

interface Ctx {
  answers: Answers;
  answer: (id: string, cls: Answers[string]) => void;
  reset: () => void;
  status: { gemini: boolean; sarvam: boolean } | null;
  fy: "curr" | "prev";
  setFy: (f: "curr" | "prev") => void;
  speak: (kn: string, en: string) => Promise<void>;
  speaking: boolean;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => useContext(C)!;

const KEY = "kavach.answers.v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<Ctx["status"]>(null);
  const [speaking, setSpeaking] = useState(false);
  const [fy, setFy] = useState<"curr" | "prev">("curr");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setAnswers(JSON.parse(raw));
    } catch {}
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ gemini: false, sarvam: false }));
  }, []);

  const persist = (a: Answers) => {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
  };

  const answer = useCallback((id: string, cls: Answers[string]) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: cls };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
    persist({});
  }, []);

  const speak = useCallback(async (kn: string, en: string) => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", { method: "POST", body: JSON.stringify({ text: kn, lang: "kn-IN" }) });
      const { audio: b64 } = await res.json();
      if (b64) {
        const a = new Audio(`data:audio/wav;base64,${b64}`);
        audio.current = a;
        await new Promise<void>((done) => { a.onended = () => done(); a.onerror = () => done(); a.play().catch(() => done()); });
        return;
      }
      // No Sarvam key — fall back to the browser voice.
      const voices = window.speechSynthesis.getVoices();
      const knVoice = voices.find((v) => v.lang.startsWith("kn"));
      const u = new SpeechSynthesisUtterance(knVoice ? kn : en);
      u.voice = knVoice ?? voices.find((v) => v.lang === "en-IN") ?? null;
      u.lang = knVoice ? "kn-IN" : "en-IN";
      u.rate = 0.98;
      await new Promise<void>((done) => { u.onend = () => done(); u.onerror = () => done(); window.speechSynthesis.speak(u); });
    } finally {
      setSpeaking(false);
    }
  }, []);

  const value = useMemo(() => ({ answers, answer, reset, status, speak, speaking, fy, setFy }), [answers, answer, reset, status, speak, speaking, fy]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
