import { receive } from "@/lib/relay/server";
import type { Envelope } from "@/lib/relay/crypto";

export const dynamic = "force-dynamic";

// Anyone may deliver a bundle: the shop's own device when it gets signal, or any phone that carried it.
// The carrier can't read it (sealed to Paytm) or change it (signed by the shop's device).
export async function POST(req: Request) {
  const { envelope, carrier } = (await req.json()) as { envelope: Envelope; carrier?: string };
  if (envelope?.v !== 1 || JSON.stringify(envelope).length > 60_000) return Response.json({ error: "bad bundle" }, { status: 400 });
  const r = await receive(envelope, carrier === "qr" ? "qr" : "direct");
  return Response.json(r, { status: r.ok ? 200 : r.status });
}
