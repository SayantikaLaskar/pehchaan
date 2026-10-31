import { register } from "@/lib/relay/server";

export async function POST(req: Request) {
  const { id, pub, shop } = (await req.json()) as { id: string; pub: JsonWebKey; shop: string };
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id ?? "") || pub?.kty !== "EC") return Response.json({ error: "bad device" }, { status: 400 });
  const r = await register(id, { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, String(shop ?? "").slice(0, 80));
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
