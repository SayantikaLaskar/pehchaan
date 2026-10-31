import { get } from "@/lib/store";
import { offerAction, type Offer, type OfferAction } from "@/lib/offers";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const o = await get<Offer>(`offer:${code}`);
  return o ? Response.json(o) : Response.json({ error: "Offer not found or expired" }, { status: 404 });
}

// Customer action from the phone: opened, redeem at the store, or stop offers from this store.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { action, offer } = (await req.json()) as { action: OfferAction; offer?: Omit<Offer, "code" | "status" | "shop" | "createdAt"> };
  const o = await offerAction(code, action, offer);
  return o ? Response.json(o) : Response.json({ error: "Offer not found or expired" }, { status: 404 });
}
