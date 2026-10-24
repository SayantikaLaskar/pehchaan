import { extractNotice, hasGemini, SAMPLE_NOTICE, withTimeout } from "@/lib/ai";

export async function POST(req: Request) {
  const { image, mediaType, sample } = (await req.json()) as { image?: string; mediaType?: string; sample?: boolean };
  if (sample || !image || !hasGemini()) return Response.json({ notice: SAMPLE_NOTICE, source: "sample" });
  try {
    const notice = await withTimeout(extractNotice(image, mediaType ?? "image/jpeg"), 35_000);
    return Response.json({ notice, source: "gemini" });
  } catch (e) {
    console.error(e);
    return Response.json({ notice: SAMPLE_NOTICE, source: "sample", error: String(e) });
  }
}
