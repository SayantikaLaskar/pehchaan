"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { collector } from "@/lib/relay/crypto";

/** An animated QR loop: one bundle split across frames, cycled so a phone camera can catch them all. */
export function QrStream({ frames, size = 300, ms = 450 }: { frames: string[]; size?: number; ms?: number }) {
  const [imgs, setImgs] = useState<string[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all(frames.map((f) => QRCode.toDataURL(f, { margin: 2, width: 720, errorCorrectionLevel: "L", color: { dark: "#06132b", light: "#ffffff" } }))).then((x) => live && setImgs(x));
    return () => { live = false; };
  }, [frames]);
  useEffect(() => {
    if (imgs.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % imgs.length), ms);
    return () => clearInterval(id);
  }, [imgs.length, ms]);
  if (!imgs.length) return <div style={{ width: size, height: size, borderRadius: 12, background: "#fff" }} />;
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgs[i % imgs.length]} alt={`Relay frame ${(i % imgs.length) + 1} of ${imgs.length}`} width={size} height={size} style={{ display: "block", borderRadius: 12, background: "#fff", imageRendering: "pixelated" }} />
      <figcaption style={{ display: "flex", gap: 4 }}>{imgs.map((_, k) => <i key={k} style={{ width: 18, height: 4, borderRadius: 2, background: k === i % imgs.length ? "var(--cyan, #2CC6F4)" : "rgba(127,127,127,.35)" }} />)}</figcaption>
    </figure>
  );
}

/** Camera scanner that reassembles a multi-frame relay QR (works in Safari on iPhone and Chrome on Android). */
export function QrScan({ onDone, kind }: { onDone: (payload: string) => void; kind: "B" | "R" }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<{ have: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, live = true;
    const c = collector(), canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (!live) return;
        const v = video.current!;
        v.srcObject = stream; v.setAttribute("playsinline", "true"); await v.play();
        const tick = () => {
          if (!live) return;
          if (v.readyState >= 2 && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
            const r = hit ? c.add(hit.data) : null;
            if (r && r.kind === kind) {
              setState({ have: r.have, total: r.total });
              if (r.done) { live = false; done.current(r.done); return; }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr("Camera unavailable — allow camera access (needs https or localhost).");
      }
    })();
    return () => { live = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [kind]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
      <video ref={video} muted playsInline style={{ width: "100%", maxHeight: 360, borderRadius: 14, background: "#000", objectFit: "cover" }} />
      <div style={{ height: 6, borderRadius: 3, background: "rgba(127,127,127,.25)", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${state ? (state.have / state.total) * 100 : 0}%`, background: "#2CC6F4", transition: "width .2s" }} /></div>
      <small style={{ fontSize: 12.5, opacity: 0.8 }}>{err || (state ? `Caught ${state.have} of ${state.total} frames — keep pointing` : "Point the camera at the shop's relay code")}</small>
    </div>
  );
}
