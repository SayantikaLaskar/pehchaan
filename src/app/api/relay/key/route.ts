import { publicKeys } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

// Public halves only: devices seal bundles to `seal` and check receipts against `sig`.
export async function GET() {
  return Response.json(await publicKeys());
}
