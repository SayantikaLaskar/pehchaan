import { fallbackMessage, hasGemini, winbackMessages, withTimeout, type Message, type WinbackInput } from "@/lib/ai";

export async function POST(req: Request) {
  const { items } = (await req.json()) as { items: (WinbackInput & { id: string })[] };
  const templates = (): Record<string, Message> => Object.fromEntries(items.map((i) => [i.id, fallbackMessage(i)]));
  if (!hasGemini()) return Response.json({ msgs: templates(), source: "template" });
  try {
    const got = await withTimeout(winbackMessages(items), 20_000);
    return Response.json({ msgs: { ...templates(), ...got }, source: "gemini" });
  } catch (e) {
    console.error("messages:", String(e).slice(0, 200));
    return Response.json({ msgs: templates(), source: "template" });
  }
}
