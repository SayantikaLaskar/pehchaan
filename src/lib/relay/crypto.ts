// Pehchaan Relay — sealed, signed bundles that any phone can carry but only Paytm can open.
// WebCrypto only (same code in the browser and on the server): ECDH P-256 + HKDF + AES-GCM to seal,
// ECDSA P-256 to sign. The carrier sees ciphertext; any change to a byte breaks the signature.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIG = { name: "ECDSA", hash: "SHA-256" } as const;

export async function newSigningKeys() {
  const k = await subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  return { priv: await subtle.exportKey("jwk", k.privateKey), pub: await subtle.exportKey("jwk", k.publicKey) };
}
export async function newSealingKeys() {
  const k = await subtle.generateKey(ECDH, true, ["deriveBits"]);
  return { priv: await subtle.exportKey("jwk", k.privateKey), pub: await subtle.exportKey("jwk", k.publicKey) };
}

export async function sign(privJwk: JsonWebKey, text: string) {
  const k = await subtle.importKey("jwk", privJwk, ECDSA, false, ["sign"]);
  return b64u(await subtle.sign(SIG, k, enc.encode(text)));
}
export async function verify(pubJwk: JsonWebKey, text: string, sig: string) {
  const k = await subtle.importKey("jwk", pubJwk, ECDSA, false, ["verify"]);
  return subtle.verify(SIG, k, unb64u(sig), enc.encode(text));
}

async function aesKey(shared: ArrayBuffer, salt: Uint8Array<ArrayBuffer>) {
  const base = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("pehchaan-relay-v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Seal `plain` so only the holder of the server's private key can read it (ECIES). */
export async function seal(serverPub: JsonWebKey, plain: string) {
  const eph = await subtle.generateKey(ECDH, true, ["deriveBits"]);
  const peer = await subtle.importKey("jwk", serverPub, ECDH, false, []);
  const shared = await subtle.deriveBits({ name: "ECDH", public: peer }, eph.privateKey, 256);
  const epk = new Uint8Array(await subtle.exportKey("raw", eph.publicKey));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(shared, epk), enc.encode(plain));
  return { k: b64u(epk), i: b64u(iv), c: b64u(ct) };
}

export async function open(serverPriv: JsonWebKey, s: { k: string; i: string; c: string }) {
  const me = await subtle.importKey("jwk", serverPriv, ECDH, false, ["deriveBits"]);
  const epkRaw = unb64u(s.k);
  const peer = await subtle.importKey("raw", epkRaw, ECDH, false, []);
  const shared = await subtle.deriveBits({ name: "ECDH", public: peer }, me, 256);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64u(s.i) }, await aesKey(shared, epkRaw), unb64u(s.c));
  return dec.decode(pt);
}

/** Short, human-checkable fingerprint of a public key (shown on both screens). */
export async function fingerprint(pub: JsonWebKey) {
  const h = new Uint8Array(await subtle.digest("SHA-256", enc.encode(`${pub.x}.${pub.y}`)));
  return Array.from(h.slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().replace(/(.{4})/, "$1-");
}

/* ───────────── the envelope a carrier holds ───────────── */

export interface Item { id: string; url: string; body: string; t: number }
export interface Envelope { v: 1; d: string; n: string; t: number; k: string; i: string; c: string; g: string }
export interface Receipt { d: string; n: string; ids: string[]; at: number; g: string }

const signed = (e: Omit<Envelope, "g">) => `${e.v}.${e.d}.${e.n}.${e.t}.${e.k}.${e.i}.${e.c}`;
export const receiptText = (r: Omit<Receipt, "g">) => `rcpt.${r.d}.${r.n}.${r.at}.${r.ids.join(",")}`;

export async function makeEnvelope(deviceId: string, devicePriv: JsonWebKey, serverPub: JsonWebKey, items: Item[]): Promise<Envelope> {
  const sealed = await seal(serverPub, JSON.stringify({ items }));
  const head = { v: 1 as const, d: deviceId, n: b64u(globalThis.crypto.getRandomValues(new Uint8Array(6))), t: Date.now(), ...sealed };
  return { ...head, g: await sign(devicePriv, signed(head)) };
}

export async function openEnvelope(e: Envelope, devicePub: JsonWebKey, serverPriv: JsonWebKey): Promise<Item[]> {
  const { g, ...head } = e;
  if (!(await verify(devicePub, signed(head), g))) throw new Error("bad signature");
  return (JSON.parse(await open(serverPriv, e)) as { items: Item[] }).items;
}

/* ───────────── QR framing: a bundle split across an animated QR loop ───────────── */

const FRAME = 600; // characters per QR frame — dense enough to be quick, sparse enough to scan off a screen

export function toFrames(kind: "B" | "R", payload: string) {
  const id = b64u(globalThis.crypto.getRandomValues(new Uint8Array(3)));
  const n = Math.ceil(payload.length / FRAME);
  return Array.from({ length: n }, (_, i) => `PR1|${kind}|${id}|${i + 1}/${n}|${payload.slice(i * FRAME, (i + 1) * FRAME)}`);
}

export function collector() {
  const got = new Map<number, string>();
  let id = "", n = 0, kind = "";
  return {
    add(frame: string): { kind: string; have: number; total: number; done: string | null } | null {
      const m = frame.match(/^PR1\|([BR])\|([^|]+)\|(\d+)\/(\d+)\|([\s\S]*)$/);
      if (!m) return null;
      if (m[2] !== id) { id = m[2]; got.clear(); n = +m[4]; kind = m[1]; }
      got.set(+m[3], m[5]);
      const done = got.size === n ? Array.from({ length: n }, (_, i) => got.get(i + 1)).join("") : null;
      return { kind, have: got.size, total: n, done };
    },
  };
}
