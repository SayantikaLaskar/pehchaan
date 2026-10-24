import { SAMPLE_NOTICE, draftReply, fallbackReply, hasGemini, withTimeout, type Notice, type Recon } from "@/lib/ai";

export async function POST(req: Request) {
  const body = (await req.json()) as { notice?: Notice; recon: Recon; sample?: boolean };
  const notice = body.sample || !body.notice ? SAMPLE_NOTICE : body.notice;
  if (!hasGemini()) return Response.json({ reply: fallbackReply(notice, body.recon), source: "template" });
  try {
    return Response.json({ reply: await withTimeout(draftReply(notice, body.recon), 25_000), source: "gemini" });
  } catch (e) {
    console.error("reply:", String(e));
    return Response.json({ reply: fallbackReply(notice, body.recon), source: "template" });
  }
}
