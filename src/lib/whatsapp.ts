// WhatsApp Cloud API (Meta). Free to start: a test business number, and replies to a customer who
// messaged you in the last 24 hours (service messages) are not charged. Without a token, Pehchaan
// falls back to wa.me click-to-chat links, which are free and need no account at all.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const SECRET = process.env.WHATSAPP_APP_SECRET;
export const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || "pehchaan-verify";
export const hasCloudApi = () => Boolean(TOKEN && PHONE_ID);

/** Reject webhook calls that Meta didn't sign (skipped only when no app secret is configured). */
export function signed(raw: string, header: string | null) {
  if (!SECRET) return true;
  if (!header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", SECRET).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function sendText(to: string, body: string) {
  if (!hasCloudApi()) return { sent: false as const };
  const res = await fetch(`https://graph.facebook.com/v23.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body: body.slice(0, 4000) } }),
  });
  return { sent: res.ok, status: res.status };
}

export interface Incoming { from: string; name: string; text: string; t: number }

/** Text messages out of a Cloud API webhook payload. */
export function incoming(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const p = payload as { entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: { from: string; timestamp: string; type: string; text?: { body: string } }[] } }[] }[] };
  for (const e of p.entry ?? [])
    for (const c of e.changes ?? []) {
      const names = new Map((c.value?.contacts ?? []).map((x) => [x.wa_id, x.profile?.name ?? ""]));
      for (const m of c.value?.messages ?? [])
        if (m.type === "text" && m.text?.body) out.push({ from: m.from, name: names.get(m.from) ?? "", text: m.text.body, t: Number(m.timestamp) * 1000 || Date.now() });
    }
  return out;
}
