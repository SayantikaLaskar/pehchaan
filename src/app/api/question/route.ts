import { askQuestion, fallbackQuestion, hasGemini, withTimeout } from "@/lib/ai";

export async function POST(req: Request) {
  const { payer, amount, date, note, reason } = await req.json();
  if (!hasGemini()) return Response.json({ q: fallbackQuestion(payer, amount, date), source: "template" });
  try {
    return Response.json({ q: await withTimeout(askQuestion(payer, amount, date, note, reason), 12_000), source: "gemini" });
  } catch (e) {
    console.error("question:", String(e));
    return Response.json({ q: fallbackQuestion(payer, amount, date), source: "template" });
  }
}
