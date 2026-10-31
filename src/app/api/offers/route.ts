import { backend, durable } from "@/lib/store";
import { createOffers, type NewOffer } from "@/lib/offers";

export type { Offer } from "@/lib/offers";

// Create one short code per offer; the phone page reads it back by code.
export async function POST(req: Request) {
  const { items } = (await req.json()) as { items: NewOffer[] };
  return Response.json({ codes: await createOffers(items), durable, backend });
}
