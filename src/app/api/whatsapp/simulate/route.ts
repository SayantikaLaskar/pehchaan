import { pushEvent } from "@/lib/store";

// Demo stand-in for a customer's WhatsApp message, for when no Cloud API number is connected.
// It travels the same path as a real webhook: event store → dashboard inbox.
export async function POST(req: Request) {
  const { id, name, text } = (await req.json()) as { id: string; name: string; text: string };
  if (!text?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  await pushEvent({ t: Date.now(), type: "order", code: "", id, from: "+91 •••• ••" + String(id).slice(-3), name, text: text.slice(0, 500), via: "simulator" });
  return Response.json({ ok: true });
}
