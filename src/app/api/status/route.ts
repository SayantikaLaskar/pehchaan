import { hasGemini, hasSarvam } from "@/lib/ai";

export function GET() {
  return Response.json({ gemini: hasGemini(), sarvam: hasSarvam() });
}
