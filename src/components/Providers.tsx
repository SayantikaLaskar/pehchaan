"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface Sent { at: number; offer: number; returned: boolean | null }

interface Ctx {
  status: { gemini: boolean; sarvam: boolean } | null;
  speak: (kn: string, en: string) => Promise<void>;
  speaking: boolean;
  sent: Record<string, Sent>;
  markSent: (ids: string[], offer: number) => void;
  markReturned: (id: string, returned: boolean) => void;
  reset: () => void;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => useContext(C)!;

const KEY = "pehchaan.sent.v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>(null);
  const [speaking, setSpeaking] = useState(false);
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSent(JSON.parse(raw));
    } catch {}
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ gemini: false, sarvam: false }));
  }, []);

  const save = (s: Record<string, Sent>) => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    return s;
  };
  const markSent = useCallback((ids: string[], offer: number) => {
    setSent((p) => save({ ...p, ...Object.fromEntries(ids.map((id) => [id, { at: Date.now(), offer, returned: null }])) }));
  }, []);
  const markReturned = useCallback((id: string, returned: boolean) => {
    setSent((p) => (p[id] ? save({ ...p, [id]: { ...p[id], returned } }) : p));
  }, []);
  const reset = useCallback(() => setSent(save({})), []);

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
      await new Promise<void>((done) => { u.onend = () => done(); u.onerror = () => done(); window.speechSynthesis.speak(u); });
    } finally {
      setSpeaking(false);
    }
  }, []);

  const value = useMemo(() => ({ status, speak, speaking, sent, markSent, markReturned, reset }), [status, speak, speaking, sent, markSent, markReturned, reset]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
