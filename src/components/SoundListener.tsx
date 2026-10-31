"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Ear, EarOff } from "lucide-react";
import { useApp } from "./Providers";
import { listen, readToken } from "@/lib/sound";
import { post } from "@/lib/outbox";

// The shop's side of zero-bar redemption: listen on the mic for a customer's offer chirp, check it
// against the offers this device sent, redeem locally, and queue the sync for when there's signal.
export function SoundListener({ compact = false }: { compact?: boolean }) {
  const { sent } = useApp();
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const stop = useRef<(() => void) | null>(null);
  const sentRef = useRef(sent);
  sentRef.current = sent;

  useEffect(() => () => stop.current?.(), []);

  const toggle = async () => {
    if (on) { stop.current?.(); stop.current = null; setOn(false); return; }
    setErr("");
    try {
      stop.current = await listen((text) => {
        const t = readToken(text);
        if (!t) return;
        const mine = sentRef.current[t.id];
        if (!mine || mine.code !== t.code) { setHeard(`Unknown offer ${t.code}`); return; }
        setHeard(`Heard offer ${t.code}`);
        window.dispatchEvent(new CustomEvent("pehchaan-local-event", { detail: { t: Date.now(), type: "redeemed", code: t.code, id: t.id } }));
        post(`/api/offers/${t.code}`, { action: "redeem" });
      });
      setOn(true);
    } catch (e) {
      setErr(String(e).includes("Permission") || String(e).includes("NotAllowed") ? "Microphone permission needed" : "Couldn't open the microphone");
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button className={`btn btn-sm ${on ? "btn-primary" : "btn-secondary"}`} onClick={toggle} title="Redeem offers played as sound from a customer's phone — works with no internet">
        {on ? <AudioLines size={14} /> : <Ear size={14} />}{on ? "Listening…" : compact ? "Listen" : "Listen for offers (no internet)"}
        {on && <EarOff size={13} style={{ opacity: 0.7 }} />}
      </button>
      {(heard || err) && <small style={{ fontSize: 12, color: err ? "var(--bad)" : "var(--text-3)" }}>{err || heard}</small>}
    </span>
  );
}
