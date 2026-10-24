import { hasSarvam, interpretAnswer, sarvamSTT } from "@/lib/ai";

export async function POST(req: Request) {
  if (!hasSarvam()) return Response.json({ transcript: null, cls: null });
  const form = await req.formData();
  const file = form.get("file") as Blob;
  try {
    const transcript = await sarvamSTT(file, (form.get("lang") as string) ?? "kn-IN");
    return Response.json({ transcript, cls: interpretAnswer(transcript) });
  } catch (e) {
    console.error(e);
    return Response.json({ transcript: null, cls: null, error: String(e) });
  }
}
