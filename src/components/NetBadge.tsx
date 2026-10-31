"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { flush, queued } from "@/lib/outbox";

// Top-bar status: online, offline (still working from cache), or syncing queued actions.
export function NetBadge() {
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => { setOnline(navigator.onLine); setCount(queued()); };
    const q = (e: Event) => setCount((e as CustomEvent<number>).detail);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("pehchaan-outbox", q);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); window.removeEventListener("pehchaan-outbox", q); };
  }, []);
  const style = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 500 } as const;
  if (!online)
    return <span style={{ ...style, background: "var(--warn-soft, #fff4e5)", color: "var(--warn)" }} title="No network. Scoring still runs on this device; actions are queued."><CloudOff size={13} />Offline{count ? ` · ${count} queued` : " · working from cache"}</span>;
  if (count)
    return <button onClick={() => flush()} style={{ ...style, background: "var(--cyan-soft)", color: "var(--navy)" }} title="Sending actions saved while offline"><RefreshCw size={13} />Syncing {count}</button>;
  return <span style={{ ...style, color: "var(--text-3)" }} title="Online"><Wifi size={13} />Online</span>;
}
