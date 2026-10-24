import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Gemini free tier (Google AI Studio key). Free-tier latency swings from seconds to minutes,
// so every call is cached and raced against a timeout by the routes.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const THINKING = process.env.GEMINI_THINKING || "low";

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
export const hasSarvam = () => Boolean(process.env.SARVAM_API_KEY);

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

type Part = { type: "text"; text: string } | { type: "image"; data: string; mime_type: string };

async function structured<T extends z.ZodType>(schema: T, system: string, input: Part[]): Promise<z.infer<T>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...json } = z.toJSONSchema(schema);
  const res = await gemini().interactions.create({
    model: MODEL,
    system_instruction: system,
    input,
    generation_config: { thinking_level: THINKING },
    response_format: { type: "text", mime_type: "application/json", schema: json },
  });
  if (!res.output_text) throw new Error("empty response");
  return schema.parse(JSON.parse(res.output_text));
}

// A slow call keeps running after its timeout and fills the cache, so the next request is instant.
const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key) as Promise<T>;
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))]);
}

/* ───────────── Notice extraction ───────────── */

export const NoticeSchema = z.object({
  reference: z.string(),
  issuedBy: z.string(),
  dateIssued: z.string(),
  replyBy: z.string(),
  period: z.string(),
  taxpayerName: z.string(),
  turnoverAlleged: z.number(),
  basis: z.string(),
  tax: z.number(),
  interest: z.number(),
  penalty: z.number(),
  total: z.number(),
  language: z.string(),
});
export type Notice = z.infer<typeof NoticeSchema>;

export const SAMPLE_NOTICE: Notice = {
  reference: "ASMT-10/KA/DVO-14/2026/08817",
  issuedBy: "Asst. Commissioner of Commercial Taxes, DVO-14, Bengaluru",
  dateIssued: "12 Oct 2026",
  replyBy: "11 Nov 2026",
  period: "FY 2025–26",
  taxpayerName: "Manjunath Gowda (Sri Manjunatha Vegetables & Provisions)",
  turnoverAlleged: 53_00_000,
  basis: "UPI receipts reported by payment aggregators exceed the registration threshold of ₹40,00,000; taxpayer is unregistered.",
  tax: 6_36_000,
  interest: 71_550,
  penalty: 63_600,
  total: 7_71_150,
  language: "English + Kannada",
};

export async function extractNotice(base64: string, mediaType: string): Promise<Notice> {
  return structured(
    NoticeSchema,
    "You read Indian GST / commercial-tax notices (often bilingual Kannada–English, sometimes photographed at an angle). Extract the fields exactly. Amounts are integers in rupees. If a field is absent use an empty string or 0.",
    [
      { type: "image", data: base64, mime_type: mediaType },
      { type: "text", text: "Extract this notice." },
    ],
  );
}

/* ───────────── Reply drafting ───────────── */

export const ReplySchema = z.object({
  subject: z.string(),
  body: z.string(),
  grounds: z.array(z.object({ title: z.string(), detail: z.string() })),
  merchantSummaryKn: z.string(),
  merchantSummaryEn: z.string(),
});
export type Reply = z.infer<typeof ReplySchema>;

export interface Recon {
  gross: number;
  business: number;
  exempt: number;
  taxable: number;
  personal: number;
  loan: number;
  own: number;
  refund: number;
  threshold: number;
  exemptShare: number;
  purchaseCount: number;
}

const L = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function fallbackReply(n: Notice, r: Recon): Reply {
  const below = r.business < r.threshold;
  return {
    subject: `Reply to notice ${n.reference} — ${n.period}`,
    body: [
      `To\nThe ${n.issuedBy}`,
      `Sir/Madam,`,
      `With reference to the above notice proposing tax of ${L(n.total)} on alleged turnover of ${L(n.turnoverAlleged)} for ${n.period}, I respectfully submit that the figure represents total UPI credits into my account and not turnover from supply of goods.`,
      `Of the ${L(r.gross)} received, ${L(r.personal + r.loan + r.own + r.refund)} are not consideration for any supply: family remittances (${L(r.personal)}), loan disbursals from regulated lenders (${L(r.loan)}), transfers of my own funds (${L(r.own)}) and refunds/reversals (${L(r.refund)}). Bank and lender statements are enclosed.`,
      `My aggregate turnover for ${n.period} is therefore ${L(r.business)}, ${below ? "which is below" : "against"} the threshold of ${L(r.threshold)} under Section 22 of the KGST/CGST Act, 2017. ${below ? "I was accordingly not liable to register, and no tax is payable." : ""} Further, approximately ${Math.round(r.exemptShare * 100)}% of my sales are fresh vegetables and fruits, which are exempt (Notification 2/2017), as evidenced by ${r.purchaseCount} purchase payments to APMC traders.`,
      `I request that the proceedings be dropped. I am willing to appear in person with all records.`,
      `Yours faithfully,\n${n.taxpayerName}`,
    ].join("\n\n"),
    grounds: [
      { title: "UPI credits ≠ turnover", detail: `${L(r.gross - r.business)} of the credits are family money, loans, own transfers and refunds.` },
      { title: below ? "Below registration threshold" : "Turnover correctly stated", detail: `True aggregate turnover is ${L(r.business)} against the ${L(r.threshold)} limit.` },
      { title: "Majority exempt supplies", detail: `About ${Math.round(r.exemptShare * 100)}% of sales are fresh produce, nil-rated under GST.` },
    ],
    merchantSummaryKn: below
      ? `ಮಂಜುನಾಥ್ ಅವರೇ, ಚಿಂತೆ ಬೇಡ. ನೋಟಿಸ್‌ನಲ್ಲಿ ${L(r.gross)} ಎಲ್ಲವನ್ನೂ ವ್ಯಾಪಾರ ಅಂತ ಲೆಕ್ಕ ಹಾಕಿದ್ದಾರೆ. ಆದರೆ ಅದರಲ್ಲಿ ಕುಟುಂಬದ ಹಣ, ಸಾಲ ಮತ್ತು ನಿಮ್ಮದೇ ಹಣ ಇದೆ. ನಿಮ್ಮ ನಿಜವಾದ ವ್ಯಾಪಾರ ${L(r.business)} — ನಲವತ್ತು ಲಕ್ಷದ ಮಿತಿಗಿಂತ ಕಡಿಮೆ. ಉತ್ತರ ಸಿದ್ಧವಾಗಿದೆ. ಒಮ್ಮೆ CA ಅವರಿಗೆ ತೋರಿಸಿ ಕಳುಹಿಸಿ. QR ತೆಗೆಯಬೇಡಿ.`
      : `ಮಂಜುನಾಥ್ ಅವರೇ, ನಿಮ್ಮ ನಿಜವಾದ ವ್ಯಾಪಾರ ${L(r.business)}. ನೋಂದಣಿ ಮಾಡಿ ಕಾಂಪೋಸಿಷನ್ ಯೋಜನೆಯಲ್ಲಿ ಕೇವಲ ಒಂದು ಶೇಕಡಾ ತೆರಿಗೆ. ಉತ್ತರ ಸಿದ್ಧವಾಗಿದೆ.`,
    merchantSummaryEn: below
      ? `Don't worry. The notice counted all ${L(r.gross)} as business, but it includes family money, loans and your own transfers. Your real business is ${L(r.business)} — below the ₹40 lakh limit. The reply is ready; show it to a CA once and send it. Don't remove your QR.`
      : `Your real business is ${L(r.business)}. Register under the composition scheme and pay just 1%. The reply is ready.`,
  };
}

export function draftReply(n: Notice, r: Recon): Promise<Reply> {
  return cached(`reply:${JSON.stringify([n, r])}`, () => structured(
    ReplySchema,
    [
      "You are a careful Indian GST practitioner drafting a reply on behalf of a small unregistered merchant in Karnataka.",
      "Rules: Section 22 CGST/KGST Act — goods-only suppliers in Karnataka must register above ₹40 lakh aggregate turnover. Aggregate turnover includes exempt supplies but excludes non-supply receipts (loans, family transfers, own-fund transfers, refunds). Fresh vegetables and fruits are nil-rated (Notification 2/2017-Central Tax (Rate)).",
      "Write the reply body as a formal letter in plain English, 5–7 short paragraphs, citing the reconciliation figures exactly (Indian digit grouping, ₹). Never invent documents beyond bank statements, lender statements and purchase payment records.",
      "grounds: 3 crisp headings with one-line detail.",
      "merchantSummaryKn: 3–4 short spoken sentences in simple Kannada addressed to Manjunath, reassuring, telling him the outcome and to keep accepting UPI. merchantSummaryEn: the same in English.",
    ].join("\n"),
    [{ type: "text", text: JSON.stringify({ notice: n, reconciliation: r }) }],
  ));
}

/* ───────────── Merchant question ───────────── */

export const QuestionSchema = z.object({
  kn: z.string(),
  en: z.string(),
  why: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export function fallbackQuestion(payer: string, amount: number, date: string): Question {
  const name = payer.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const amt = amount.toLocaleString("en-IN");
  return {
    kn: `${date} ರಂದು ${name} ಅವರಿಂದ ₹${amt} ಬಂದಿದೆ. ಇದು ಅಂಗಡಿ ವ್ಯಾಪಾರವೇ, ಅಥವಾ ಮನೆಯ / ಸ್ನೇಹಿತರ ಹಣವೇ?`,
    en: `₹${amt} came from ${name} on ${date}. Was this a shop sale, or family / friend money?`,
    why: "One answer keeps your turnover accurate for every future notice.",
  };
}

export function askQuestion(payer: string, amount: number, date: string, note: string, reason: string): Promise<Question> {
  return cached(`q:${payer}:${amount}:${date}`, () => structured(
    QuestionSchema,
    "You are Kavach, a friendly bookkeeping assistant on a Paytm Soundbox for a Bengaluru vegetable shop owner named Manjunath. Ask ONE short spoken question to decide whether a UPI credit is a business sale or personal money. kn: natural spoken Kannada (not formal), ≤ 25 words, mention payer first name and amount. en: same in English. why: ≤ 14 words on why it matters.",
    [{ type: "text", text: JSON.stringify({ payer, amount, date, note, reason }) }],
  ));
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

export async function sarvamSTT(file: Blob, lang: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, "answer.webm");
  form.append("model", "saaras:v4");
  form.append("language_code", lang);
  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY! },
    body: form,
  });
  if (!res.ok) throw new Error(`sarvam stt ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { transcript: string };
  return json.transcript;
}

/** Map a spoken answer to a class without a model call — Kannada, Hindi, English keywords. */
export function interpretAnswer(t: string): "sale" | "personal" | null {
  const s = t.toLowerCase();
  if (/(ವ್ಯಾಪಾರ|ಅಂಗಡಿ|ಆರ್ಡರ್|ಮಾರಾಟ|sale|order|business|shop|dhanda|dhandha|bikri|बिक्री|धंधा|दुकान)/.test(s)) return "sale";
  if (/(ಮನೆ|ಕುಟುಂಬ|ಸ್ನೇಹಿತ|ಸಾಲ|ವಾಪಸ್|family|friend|personal|ghar|dost|wapas|घर|दोस्त|उधार|personal)/.test(s)) return "personal";
  return null;
}
