// End-to-end check of the offline relay against a running server (default http://localhost:3000).
// Run: npx tsx scripts/relay-check.ts [baseUrl]
import { makeEnvelope, newSigningKeys, receiptText, verify, toFrames, collector, type Item } from "../src/lib/relay/crypto";

const B = process.argv[2] ?? "http://localhost:3000";
const post = (p: string, b: unknown) => fetch(B + p, { method: "POST", body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json() }));

(async () => {
const dev = await newSigningKeys();
const id = "dev-" + crypto.randomUUID().slice(0, 12);
console.log("register:", (await post("/api/relay/register", { id, pub: dev.pub, shop: "Sri Manjunatha Stores" })).status);
const keys = await fetch(B + "/api/relay/key").then((r) => r.json());

// A redemption that happened 3 hours ago, while the shop had no network.
const code = Math.random().toString(36).slice(2, 8).padEnd(6, "x");
const items: Item[] = [
  { id: crypto.randomUUID(), url: "/api/offers", body: JSON.stringify({ items: [{ id: "C076", code, first: "Aisha", kn: "", en: "", offer: 30 }] }), t: Date.now() - 4 * 3600e3 },
  { id: crypto.randomUUID(), url: `/api/offers/${code}`, body: JSON.stringify({ action: "redeem" }), t: Date.now() - 3 * 3600e3 },
];
const env = await makeEnvelope(id, dev.priv, keys.seal, items);
const text = JSON.stringify(env);
const frames = toFrames("B", text);
const c = collector(); let whole: string | null = null;
for (const f of [...frames].reverse()) whole = c.add(f)?.done ?? whole; // frames can arrive in any order
console.log(`bundle ${text.length} chars → ${frames.length} QR frames; reassembled ok: ${whole === text}`);

const first = await post("/api/relay/bundle", { envelope: JSON.parse(whole!), carrier: "qr" });
console.log("deliver via carrier:", first.status, { applied: first.json.applied, duplicate: first.json.duplicate, delayH: (first.json.delayMs / 3600e3).toFixed(1) });
console.log("receipt signed by Paytm:", await verify(keys.sig, receiptText(first.json.receipt), first.json.receipt.g));
const again = await post("/api/relay/bundle", { envelope: env, carrier: "direct" });
console.log("same bundle again (second carrier):", again.status, { applied: again.json.applied, duplicate: again.json.duplicate });
const tampered = { ...env, c: env.c.slice(0, -4) + (env.c.endsWith("AAAA") ? "BBBB" : "AAAA") };
console.log("tampered in transit:", (await post("/api/relay/bundle", { envelope: tampered, carrier: "qr" })).status);
const offer = await fetch(`${B}/api/offers/${code}`).then((r) => r.json());
console.log("offer status on server:", offer.status);
})();
