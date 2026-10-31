"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ConsentStatus } from "@/lib/pehchaan/consent";

export interface Sent { at: number; offer: number; returned: boolean | null }
export interface Audit { t: number; actor: "Agent" | "Merchant" | "Customer" | "System"; action: string; subject?: string; detail: string }

interface Ctx {
  status: { gemini: boolean; sarvam: boolean } | null;
  speak: (kn: string, en: string) => Promise<void>;
  speaking: boolean;
  sent: Record<string, Sent>;
  markSent: (ids: string[], offer: number, why?: Record<string, string>) => void;
  markReturned: (id: string, returned: boolean) => void;
  consent: Record<string, ConsentStatus>; // overrides on top of the captured baseline
  setConsent: (id: string, status: ConsentStatus, name?: string) => void;
  audit: Audit[];
  log: (e: Omit<Audit, "t">) => void;
  reset: () => void;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => useContext(C)!;

const KEY = "pehchaan.state.v2";
interface Saved { sent: Record<string, Sent>; consent: Record<string, ConsentStatus>; audit: Audit[] }

export function Providers({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>(null);
  const [speaking, setSpeaking] = useState(false);
  const [state, setState] = useState<Saved>({ sent: {}, consent: {}, audit: [] });
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ sent: {}, consent: {}, audit: [], ...JSON.parse(raw) });
    } catch {}
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ gemini: false, sarvam: false }));
  }, []);

  const update = useCallback((fn: (s: Saved) => Saved) => {
    setState((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const entry = (e: Omit<Audit, "t">): Audit => ({ ...e, t: Date.now() });

  const log = useCallback((e: Omit<Audit, "t">) => update((s) => ({ ...s, audit: [entry(e), ...s.audit].slice(0, 500) })), [update]);

  const markSent = useCallback((ids: string[], offer: number, why: Record<string, string> = {}) => {
    update((s) => ({
      ...s,
      sent: { ...s.sent, ...Object.fromEntries(ids.map((id) => [id, { at: Date.now(), offer, returned: null }])) },
      audit: [...ids.map((id) => entry({ actor: "Agent", action: "Offer sent", subject: id, detail: `₹${offer} store offer via Paytm app · ${why[id] ?? "slipping away"}` })), ...s.audit].slice(0, 500),
    }));
  }, [update]);

  const markReturned = useCallback((id: string, returned: boolean) => {
    update((s) => (s.sent[id] ? {
      ...s,
      sent: { ...s.sent, [id]: { ...s.sent[id], returned } },
      audit: [entry({ actor: returned ? "Customer" : "System", action: returned ? "Returned" : "No visit", subject: id, detail: returned ? "Paid at Soundbox after offer" : "No visit within 7 days" }), ...s.audit],
    } : s));
  }, [update]);

  const setConsent = useCallback((id: string, status: ConsentStatus, name?: string) => {
    update((s) => ({
      ...s,
      consent: { ...s.consent, [id]: status },
      audit: [entry({ actor: status === "erased" ? "Merchant" : "Customer", action: status === "erased" ? "Data erased" : status === "withdrawn" ? "Consent withdrawn" : "Consent given", subject: id, detail: status === "erased" ? `${name ?? "Customer"}'s profile and payment summary deleted` : "Updated in consent ledger" }), ...s.audit],
    }));
  }, [update]);

  const reset = useCallback(() => update(() => ({ sent: {}, consent: {}, audit: [] })), [update]);

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

  const value = useMemo(
    () => ({ status, speak, speaking, sent: state.sent, markSent, markReturned, consent: state.consent, setConsent, audit: state.audit, log, reset }),
    [status, speak, speaking, state, markSent, markReturned, setConsent, log, reset],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
