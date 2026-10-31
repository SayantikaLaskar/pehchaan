"use client";
// Data over sound for places with no network at all. The customer's phone plays the offer token as a
// two-second chirp; the shop's phone (or a Soundbox with a mic) hears it and redeems on the spot.
// No internet, no Bluetooth pairing, works on any phone with a speaker. Uses ggwave (MIT), vendored in
// /public so it loads from the app's own offline cache.

interface GG {
  getDefaultParameters(): { sampleRateInp: number; sampleRateOut: number };
  init(p: unknown): number;
  encode(i: number, text: string, protocol: number, volume: number): Int8Array;
  decode(i: number, data: Int8Array): Uint8Array | null;
  ProtocolId: Record<string, number>;
}
declare global { interface Window { ggwave_factory?: () => Promise<GG> } }

let lib: Promise<GG> | null = null;
function load(): Promise<GG> {
  return (lib ??= new Promise<GG>((ok, fail) => {
    if (window.ggwave_factory) return void window.ggwave_factory().then(ok, fail);
    const s = document.createElement("script");
    s.src = "/vendor/ggwave-0.4.0.js";
    s.onload = () => window.ggwave_factory!().then(ok, fail);
    s.onerror = () => { lib = null; fail(new Error("sound library failed to load")); };
    document.head.appendChild(s);
  }));
}

const conv = <T extends ArrayBufferView>(src: ArrayBufferView, T: new (b: ArrayBuffer) => T) => {
  const b = new ArrayBuffer(src.byteLength);
  new Uint8Array(b).set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
  return new T(b);
};

export const token = (code: string, id: string) => `PCH1:${code}:${id}`;
export const readToken = (t: string) => { const m = t.match(/^PCH1:([A-Za-z0-9_-]{6}):([A-Za-z0-9:]+)$/); return m ? { code: m[1], id: m[2] } : null; };

/** Play `text` as sound. Resolves when it has finished. */
export async function transmit(text: string) {
  const g = await load();
  const ctx = new AudioContext({ sampleRate: 48000 });
  const p = g.getDefaultParameters();
  p.sampleRateInp = ctx.sampleRate; p.sampleRateOut = ctx.sampleRate;
  const inst = g.init(p);
  await ctx.resume();
  const wave = conv(g.encode(inst, text, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 25), Float32Array);
  const buf = ctx.createBuffer(1, wave.length, ctx.sampleRate);
  buf.getChannelData(0).set(wave);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination);
  await new Promise<void>((done) => { src.onended = () => done(); src.start(); });
  await ctx.close();
}

/** Listen on the microphone; calls `onText` for every message heard. Returns a stop function. */
export async function listen(onText: (text: string) => void): Promise<() => void> {
  const g = await load();
  const ctx = new AudioContext({ sampleRate: 48000 });
  const p = g.getDefaultParameters();
  p.sampleRateInp = ctx.sampleRate; p.sampleRateOut = ctx.sampleRate;
  const inst = g.init(p);
  // Echo cancellation and noise suppression would erase the very tones we are listening for.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
  await ctx.resume();
  const mic = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(1024, 1, 1);
  proc.onaudioprocess = (e) => {
    const res = g.decode(inst, conv(new Float32Array(e.inputBuffer.getChannelData(0)), Int8Array));
    if (res && res.length) onText(new TextDecoder().decode(res));
  };
  mic.connect(proc); proc.connect(ctx.destination);
  return () => { proc.disconnect(); mic.disconnect(); stream.getTracks().forEach((t) => t.stop()); ctx.close(); };
}
