// WhatsApp ordering for customers who can't or won't come to the counter (lockdowns, rain, illness).
// Free paths only: wa.me click-to-chat links and UPI deep links need no account; the WhatsApp Cloud
// API (free test number, free replies inside the 24-hour customer-service window) is optional.
import { SHOP } from "./sim";

export interface Item { name: string; qty: number; unit: string; price: number }

// A kirana's everyday list, with the words customers actually type in Kannada, Hindi and English.
const CATALOG: { name: string; unit: string; price: number; words: string[] }[] = [
  { name: "Milk (Nandini, 500 ml)", unit: "pkt", price: 27, words: ["milk", "haalu", "ಹಾಲು", "दूध", "doodh"] },
  { name: "Curd (500 g)", unit: "pkt", price: 32, words: ["curd", "mosaru", "ಮೊಸರು", "दही", "dahi"] },
  { name: "Bread", unit: "pkt", price: 45, words: ["bread", "ಬ್ರೆಡ್", "ब्रेड"] },
  { name: "Eggs", unit: "pc", price: 7, words: ["egg", "eggs", "motte", "ಮೊಟ್ಟೆ", "अंडे", "anda", "ande"] },
  { name: "Rice (Sona Masoori)", unit: "kg", price: 62, words: ["rice", "akki", "ಅಕ್ಕಿ", "चावल", "chawal"] },
  { name: "Atta", unit: "kg", price: 48, words: ["atta", "flour", "ಹಿಟ್ಟು", "आटा"] },
  { name: "Toor dal", unit: "kg", price: 160, words: ["dal", "toor", "bele", "ಬೇಳೆ", "दाल"] },
  { name: "Sugar", unit: "kg", price: 46, words: ["sugar", "sakkare", "ಸಕ್ಕರೆ", "चीनी", "cheeni"] },
  { name: "Sunflower oil (1 L)", unit: "L", price: 155, words: ["oil", "enne", "ಎಣ್ಣೆ", "तेल", "tel"] },
  { name: "Onion", unit: "kg", price: 40, words: ["onion", "eerulli", "ಈರುಳ್ಳಿ", "प्याज", "pyaz", "pyaaz"] },
  { name: "Tomato", unit: "kg", price: 30, words: ["tomato", "ಟೊಮ್ಯಾಟೊ", "ಟೊಮೆಟೊ", "टमाटर", "tamatar"] },
  { name: "Potato", unit: "kg", price: 35, words: ["potato", "aloo", "ಆಲೂಗಡ್ಡೆ", "आलू"] },
  { name: "Coffee powder (200 g)", unit: "pkt", price: 120, words: ["coffee", "ಕಾಫಿ", "कॉफी"] },
  { name: "Tea (250 g)", unit: "pkt", price: 130, words: ["tea", "chai", "ಟೀ", "चाय"] },
  { name: "Soap", unit: "pc", price: 40, words: ["soap", "sabun", "ಸೋಪು", "साबुन"] },
];

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, dozen: 12, half: 0.5,
  ondu: 1, eradu: 2, mooru: 3, ಒಂದು: 1, ಎರಡು: 2, ಮೂರು: 3, ಅರ್ಧ: 0.5,
  ek: 1, do: 2, teen: 3, एक: 1, दो: 2, तीन: 3, आधा: 0.5,
};

/** "2 milk, 1kg rice, 6 eggs" / "ಎರಡು ಹಾಲು, ಒಂದು ಕೆಜಿ ಅಕ್ಕಿ" / "दो दूध" → items with prices. */
export function parseOrder(text: string): Item[] {
  const parts = text.toLowerCase().split(/[,\n;+]|\band\b|\bmattu\b|ಮತ್ತು|और/).map((p) => p.trim()).filter(Boolean);
  const items: Item[] = [];
  for (const p of parts) {
    const hit = CATALOG.find((c) => c.words.some((w) => p.includes(w)));
    if (!hit) continue;
    const digit = p.match(/(\d+(?:\.\d+)?)/);
    const word = Object.keys(NUM).find((w) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(p));
    const qty = digit ? parseFloat(digit[1]) : word ? NUM[word] : 1;
    const existing = items.find((x) => x.name === hit.name);
    if (existing) existing.qty += qty;
    else items.push({ name: hit.name, qty, unit: hit.unit, price: hit.price });
  }
  return items;
}

export const total = (items: Item[]) => Math.round(items.reduce((s, i) => s + i.qty * i.price, 0));

/** NPCI UPI deep link — opens any UPI app with the amount filled in. Free, no gateway. */
export function upiLink(amount: number, note: string) {
  const q = new URLSearchParams({ pa: SHOP.vpa, pn: SHOP.short, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString()}`;
}

/**
 * WhatsApp click-to-chat — free, no account. With a number it opens that chat; without one it opens
 * WhatsApp's "send to…" picker, which is always valid (a made-up number is not).
 */
export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const WA_KEY = "pehchaan.merchantWa";
// The demo shop's WhatsApp (the team's number for the hackathon); override in Settings or NEXT_PUBLIC_MERCHANT_WHATSAPP.
const DEMO_SHOP_WA = "916394082247";
/** The shop's own WhatsApp number: Settings first, then the deployment default. Digits with country code. */
export function merchantWa(): string {
  let v = "";
  try { v = localStorage.getItem(WA_KEY) ?? ""; } catch {}
  return (v || process.env.NEXT_PUBLIC_MERCHANT_WHATSAPP || DEMO_SHOP_WA).replace(/\D/g, "");
}
export function setMerchantWa(v: string) {
  const d = v.replace(/\D/g, "");
  const full = d.length === 10 ? "91" + d : d;
  try { localStorage.setItem(WA_KEY, full); } catch {}
  return full;
}

export function confirmText(first: string, items: Item[], amount: number) {
  const list = items.map((i) => `• ${i.qty} ${i.unit} ${i.name}`).join("\n");
  return {
    kn: `ನಮಸ್ಕಾರ ${first}! ನಿಮ್ಮ ಆರ್ಡರ್ ಸಿಕ್ಕಿದೆ:\n${list}\nಒಟ್ಟು ₹${amount}. 30 ನಿಮಿಷದಲ್ಲಿ ಮನೆಗೆ ತಲುಪಿಸುತ್ತೇವೆ. UPI ಮೂಲಕ ಪಾವತಿಸಿ.`,
    en: `Hi ${first}! Got your order:\n${list}\nTotal ₹${amount}. Delivering in 30 minutes — pay by UPI on delivery.`,
  };
}

export const mask = (phone: string) => phone.replace(/\D/g, "").replace(/^(\d{2})\d+(\d{3})$/, "+$1 •••• ••$2");
