import { simulatedOrder } from "@/lib/offers";

// Demo stand-in for a customer's WhatsApp message, for when no Cloud API number is connected.
// It travels the same path as a real webhook: event store → dashboard inbox.
export async function POST(req: Request) {
  const { id, name, text } = (await req.json()) as { id: string; name: string; text: string };
  if (!text?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  await simulatedOrder(id, name, text);
  return Response.json({ ok: true });
}
