import { receipts } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("d") ?? "";
  return Response.json({ receipts: await receipts(d) });
}
