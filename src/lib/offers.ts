// Server-side actions on offers and orders. The HTTP routes call these directly, and the offline relay
// replays queued actions through the very same functions — one code path, whichever way data arrives.
import { randomBytes } from "node:crypto";
import { get, pushEvent, put } from "@/lib/store";

export interface Offer { code: string; id: string; first: string; kn: string; hi?: string; en: string; lang?: "kn" | "hi" | "en"; offer: number; shop: string; createdAt: number; status: "sent" | "redeemed" | "optout" }
export type NewOffer = { id: string; code?: string; first: string; kn: string; hi?: string; en: string; lang?: "kn" | "hi" | "en"; offer: number };
export type OfferAction = "open" | "redeem" | "optout";

const SHOP = "Sri Manjunatha Stores";

export async function createOffers(items: NewOffer[], at = Date.now()) {
  const codes: Record<string, string> = {};
  for (const it of items.slice(0, 50)) {
    // The dashboard may mint the code itself (so an offline send can still print its QR); keep it if well-formed.
    const code = it.code && /^[A-Za-z0-9_-]{6}$/.test(it.code) ? it.code : randomBytes(4).toString("base64url").slice(0, 6);
    if (!(await get<Offer>(`offer:${code}`))) await put(`offer:${code}`, { ...it, code, shop: SHOP, createdAt: at, status: "sent" } satisfies Offer);
    codes[it.id] = code;
  }
  return codes;
}

/** `at` is when it happened (a relayed redemption may arrive hours later); events are stamped on arrival. */
export async function offerAction(code: string, action: OfferAction, embedded?: Omit<Offer, "code" | "status" | "shop" | "createdAt"> | null, at?: number, via?: string) {
  const o = (await get<Offer>(`offer:${code}`)) ?? (embedded ? { ...embedded, code, shop: SHOP, createdAt: Date.now(), status: "sent" as const } : null);
  if (!o) return null;
  if (action === "open") {
    await pushEvent({ t: Date.now(), type: "opened", code, id: o.id, ...(at ? { at } : {}), ...(via ? { via } : {}) });
    return o;
  }
  if (o.status !== "sent") return o;
  const next: Offer = { ...o, status: action === "redeem" ? "redeemed" : "optout" };
  await put(`offer:${code}`, next);
  await pushEvent({ t: Date.now(), type: action === "redeem" ? "redeemed" : "optout", code, id: o.id, ...(at ? { at } : {}), ...(via ? { via } : {}) });
  return next;
}

export async function simulatedOrder(id: string, name: string, text: string, at?: number) {
  await pushEvent({ t: Date.now(), type: "order", code: "", id, from: "+91 •••• ••" + String(id).slice(-3), name, text: text.slice(0, 500), via: "simulator", ...(at ? { at } : {}) });
}
