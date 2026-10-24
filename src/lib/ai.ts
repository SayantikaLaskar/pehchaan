import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import seed from "./ai-seed.json";

// Gemini free tier (Google AI Studio key). Daily quotas are small (as low as 20 requests per model)
// and latency swings from seconds to minutes, so: one call per task, answers cached on disk,
// a second model when the first is out of quota, and a timeout + template in every route.
const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.6-flash"])];
const THINKING = process.env.GEMINI_THINKING || "low";

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
export const hasSarvam = () => Boolean(process.env.SARVAM_API_KEY);

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

async function structured<T extends z.ZodType>(schema: T, system: string, input: string): Promise<z.infer<T>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...json } = z.toJSONSchema(schema);
  let last: unknown;
  for (const model of MODELS) {
    try {
      const res = await gemini().interactions.create({
        model,
        system_instruction: system,
        input: [{ type: "text", text: input }],
        generation_config: { thinking_level: THINKING },
        response_format: { type: "text", mime_type: "application/json", schema: json },
      });
      if (!res.output_text) throw new Error("empty response");
      return schema.parse(JSON.parse(res.output_text));
    } catch (e) {
      last = e;
      if (!/429|rate limit|quota/i.test(String(e))) throw e;
    }
  }
  throw last;
}

const DISK = ".cache/ai.json";
// Answers generated during development ship with the app, so demo paths cost no quota in production.
let disk: Record<string, unknown> = { ...(seed as Record<string, unknown>) };
try { disk = { ...disk, ...JSON.parse(readFileSync(DISK, "utf8")) }; } catch {}

// In-flight calls are shared; finished answers go to disk so restarts and repeat demos cost no quota.
const inflight = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (key in disk) return Promise.resolve(disk[key] as T);
  if (!inflight.has(key))
    inflight.set(key, fn().then((v) => {
      disk[key] = v;
      try { mkdirSync(".cache", { recursive: true }); writeFileSync(DISK, JSON.stringify(disk, null, 1)); } catch {}
      return v;
    }).catch((e) => { inflight.delete(key); throw e; }));
  return inflight.get(key) as Promise<T>;
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))]);
}

/* ───────────── Win-back message ───────────── */

export const MessageSchema = z.object({ kn: z.string(), en: z.string() });
export type Message = z.infer<typeof MessageSchema>;

export interface WinbackInput {
  name: string;
  usual: string; // "every 3 days"
  lastSeen: number; // days
  favourite: string; // what they usually buy
  offer: number; // ₹ off
}

const KN_ITEM: Record<string, string> = { "milk and vegetables": "ಹಾಲು ಮತ್ತು ತರಕಾರಿ", vegetables: "ತರಕಾರಿ", groceries: "ದಿನಸಿ", fruits: "ಹಣ್ಣು" };

export function fallbackMessage({ name, lastSeen, favourite, offer }: WinbackInput): Message {
  const first = name.split(" ")[0];
  const item = KN_ITEM[favourite] ?? "ತರಕಾರಿ";
  return {
    kn: `ನಮಸ್ಕಾರ ${first} ಅವರೇ! ${lastSeen} ದಿನಗಳಿಂದ ನಿಮ್ಮನ್ನು ನೋಡಿಲ್ಲ. ಇವತ್ತು ತಾಜಾ ${item} ಬಂದಿದೆ — ನಿಮಗಾಗಿ ₹${offer} ರಿಯಾಯಿತಿ, ಈ ವಾರ ಮಾತ್ರ. — ಮಂಜುನಾಥ್, ಶ್ರೀ ಮಂಜುನಾಥ ಸ್ಟೋರ್ಸ್`,
    en: `Namaskara ${first}! We haven't seen you in ${lastSeen} days. Fresh ${favourite} arrived today — ₹${offer} off for you, this week only. — Manjunath, Sri Manjunatha Stores`,
  };
}

const MessagesSchema = z.object({ messages: z.array(z.object({ id: z.string(), kn: z.string(), en: z.string() })) });

/** One call writes the whole campaign. */
export function winbackMessages(items: (WinbackInput & { id: string })[]): Promise<Record<string, Message>> {
  return cached(`msgs:${JSON.stringify(items)}`, async () => {
    const { messages } = await structured(
      MessagesSchema,
      "You write short, warm messages from a Bengaluru kirana owner (Manjunath, Sri Manjunatha Stores, HSR Layout) to regular customers who have stopped coming. Each is delivered as a Paytm app notification. Sound like a neighbour, not a brand: use their first name, mention what they usually buy, state the offer once. No emojis, no pressure, under 35 words each. Return one message per input id. kn: natural spoken Kannada in Kannada script. en: the same in English.",
      JSON.stringify(items),
    );
    return Object.fromEntries(messages.map((m) => [m.id, { kn: m.kn, en: m.en }]));
  });
}

/* ───────────── Morning brief ───────────── */

export const BriefSchema = z.object({ kn: z.string(), en: z.string() });
export type Brief = z.infer<typeof BriefSchema>;

export interface BriefInput {
  slipping: { name: string; lastSeen: number; usual: number }[];
  expectedToday: number;
  revenueAtRisk: number;
  areaAlert: boolean;
}

export function fallbackBrief(b: BriefInput): Brief {
  const names = b.slipping.slice(0, 3).map((s) => s.name.split(" ")[0]);
  return {
    kn: `ಶುಭೋದಯ ಮಂಜುನಾಥ್ ಅವರೇ. ಇವತ್ತು ಸುಮಾರು ${b.expectedToday} ಗ್ರಾಹಕರು ಬರುವ ನಿರೀಕ್ಷೆ. ${names.join(", ")} ಸ್ವಲ್ಪ ದಿನಗಳಿಂದ ಬಂದಿಲ್ಲ — ಅವರಿಗೆ ಆಫರ್ ಕಳುಹಿಸಲೇ?${b.areaAlert ? " ನಿಮ್ಮ ಏರಿಯಾದಲ್ಲಿ ಹೊಸ ಆನ್‌ಲೈನ್ ಡೆಲಿವರಿ ಸ್ಟೋರ್ ಶುರುವಾದಂತಿದೆ." : ""}`,
    en: `Good morning Manjunath. About ${b.expectedToday} customers expected today. ${names.join(", ")} haven't come in a while — shall I send them an offer?${b.areaAlert ? " A new quick-commerce store seems to have opened in your area." : ""}`,
  };
}

export function morningBrief(b: BriefInput): Promise<Brief> {
  return cached(`brief:${JSON.stringify(b)}`, () =>
    structured(
      BriefSchema,
      "You are Pehchaan, the assistant inside a Paytm Soundbox at a Bengaluru kirana. Write the owner's 20-second spoken morning brief: greet Manjunath, say how many customers to expect, name up to three regulars who have stopped coming (first names only) and offer to send them a win-back offer, and mention the area alert if true. Plain spoken Kannada in Kannada script for kn, under 55 words. en: the same in English.",
      JSON.stringify(b),
    ),
  );
}

/* ───────────── Sarvam voice ───────────── */

export async function sarvamTTS(text: string, lang: string): Promise<string | null> {
  if (!hasSarvam()) return null;
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 2400), language_code: lang, model: "bulbul:v3", speaker: "kavya", pace: 1.0 }),
  });
  if (!res.ok) throw new Error(`sarvam tts ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { audios: string[] };
  return json.audios?.[0] ?? null;
}
