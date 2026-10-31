import { get, pushEvent, put } from "@/lib/store";
import type { Offer } from "../route";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const o = await get<Offer>(`offer:${code}`);
  return o ? Response.json(o) : Response.json({ error: "Offer not found or expired" }, { status: 404 });
}

// Customer action from the phone: redeem at the store, or stop offers from this store.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { action, offer } = (await req.json()) as { action: "redeem" | "optout"; offer?: Omit<Offer, "code" | "status" | "shop" | "createdAt"> };
  const o = (await get<Offer>(`offer:${code}`)) ?? (offer ? { ...offer, code, shop: "Sri Manjunatha Stores", createdAt: Date.now(), status: "sent" as const } : null);
  if (!o) return Response.json({ error: "Offer not found or expired" }, { status: 404 });
  if (o.status !== "sent") return Response.json(o);
  const next: Offer = { ...o, status: action === "redeem" ? "redeemed" : "optout" };
  await put(`offer:${code}`, next);
  await pushEvent({ t: Date.now(), type: action === "redeem" ? "redeemed" : "optout", code, id: o.id });
  return Response.json(next);
}
