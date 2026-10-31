import { hasSarvam, sarvamSTT } from "@/lib/ai";

export async function POST(req: Request) {
  if (!hasSarvam()) return Response.json({ transcript: null });
  const form = await req.formData();
  try {
    return Response.json({ transcript: await sarvamSTT(form.get("file") as Blob, (form.get("lang") as string) || "kn-IN") });
  } catch (e) {
    console.error("stt:", String(e).slice(0, 200));
    return Response.json({ transcript: null });
  }
}
