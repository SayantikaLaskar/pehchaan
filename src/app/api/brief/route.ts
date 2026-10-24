import { fallbackBrief, hasGemini, morningBrief, withTimeout, type BriefInput } from "@/lib/ai";

export async function POST(req: Request) {
  const input = (await req.json()) as BriefInput;
  if (!hasGemini()) return Response.json({ brief: fallbackBrief(input), source: "template" });
  try {
    return Response.json({ brief: await withTimeout(morningBrief(input), 15_000), source: "gemini" });
  } catch (e) {
    console.error("brief:", String(e).slice(0, 200));
    return Response.json({ brief: fallbackBrief(input), source: "template" });
  }
}
