import { backend, durable, events } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
  return Response.json({ events: await events(since), durable, backend });
}
