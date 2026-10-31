import { createHash } from "node:crypto";
import { pushEvent } from "@/lib/store";
import { VERIFY, hasCloudApi, incoming, sendText, signed } from "@/lib/whatsapp";
import { confirmText, mask, parseOrder, total } from "@/lib/pehchaan/orders";

export const dynamic = "force-dynamic";

const idOf = (phone: string) => "wa:" + createHash("sha256").update(phone).digest("hex").slice(0, 10);

// Meta's one-time webhook verification.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === VERIFY) return new Response(q.get("hub.challenge") ?? "");
  return Response.json({ cloudApi: hasCloudApi(), webhook: "POST /api/whatsapp" }, { status: q.has("hub.mode") ? 403 : 200 });
}

// A customer messages the shop's WhatsApp: the order lands on the dashboard, and they get an instant
// confirmation (a free service reply, inside the 24-hour window they just opened).
export async function POST(req: Request) {
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  for (const m of incoming(JSON.parse(raw))) {
    await pushEvent({ t: Date.now(), type: "order", code: "", id: idOf(m.from), from: mask(m.from), name: m.name, text: m.text, via: "cloud-api" });
    const items = parseOrder(m.text);
    if (items.length) await sendText(m.from, confirmText(m.name.split(" ")[0] || "", items, total(items)).kn);
  }
  return new Response("ok");
}
