import { randomBytes } from "node:crypto";
import { backend, durable, put } from "@/lib/store";

export interface Offer { code: string; id: string; first: string; kn: string; hi?: string; en: string; lang?: "kn" | "hi" | "en"; offer: number; shop: string; createdAt: number; status: "sent" | "redeemed" | "optout" }

// Create one short code per offer; the phone page reads it back by code.
export async function POST(req: Request) {
  const { items } = (await req.json()) as { items: { id: string; code?: string; first: string; kn: string; hi?: string; en: string; lang?: "kn" | "hi" | "en"; offer: number }[] };
  const codes: Record<string, string> = {};
  for (const it of items.slice(0, 50)) {
    // The dashboard may mint the code itself (so an offline send can still print its QR); keep it if well-formed.
    const code = it.code && /^[A-Za-z0-9_-]{6}$/.test(it.code) ? it.code : randomBytes(4).toString("base64url").slice(0, 6);
    const o: Offer = { ...it, code, shop: "Sri Manjunatha Stores", createdAt: Date.now(), status: "sent" };
    await put(`offer:${code}`, o);
    codes[it.id] = code;
  }
  return Response.json({ codes, durable, backend });
}
