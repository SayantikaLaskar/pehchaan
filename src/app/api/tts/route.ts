import { sarvamTTS } from "@/lib/ai";

export async function POST(req: Request) {
  const { text, lang } = await req.json();
  try {
    const audio = await sarvamTTS(text, lang ?? "kn-IN");
    return Response.json({ audio });
  } catch (e) {
    console.error(e);
    return Response.json({ audio: null, error: String(e) });
  }
}
