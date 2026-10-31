// The Soundbox speaks the shopkeeper's language. Every spoken line carries all three.
export type Lang = "kn" | "hi" | "en";
export interface Say { kn: string; hi: string; en: string }

export const LANGS: { k: Lang; label: string; code: string }[] = [
  { k: "kn", label: "ಕನ್ನಡ", code: "kn-IN" },
  { k: "hi", label: "हिंदी", code: "hi-IN" },
  { k: "en", label: "English", code: "en-IN" },
];
export const codeOf = (l: Lang) => LANGS.find((x) => x.k === l)!.code;

export const lines = {
  back: (first: string, days?: number): Say => ({
    kn: days ? `${first} ಅವರು ${days} ದಿನಗಳ ನಂತರ ಮತ್ತೆ ಬಂದಿದ್ದಾರೆ. ಸ್ವಾಗತಿಸಿ!` : `${first} ಅವರು ಮತ್ತೆ ಬಂದಿದ್ದಾರೆ. ಸ್ವಾಗತಿಸಿ!`,
    hi: days ? `${first} जी ${days} दिन बाद वापस आए हैं। स्वागत कीजिए!` : `${first} जी वापस आए हैं। स्वागत कीजिए!`,
    en: days ? `${first} is back after ${days} days. Give them a warm welcome!` : `${first} is back. Give them a warm welcome!`,
  }),
  // The offer lives with the shop, keyed to the customer's UPI ID: they just pay, the Soundbox applies it.
  applied: (first: string, offer: number): Say => ({
    kn: `${first} ಅವರೇ, ಮತ್ತೆ ಸ್ವಾಗತ! ನಿಮ್ಮ ₹${offer} ರಿಯಾಯಿತಿ ಅನ್ವಯಿಸಲಾಗಿದೆ.`,
    hi: `${first} जी, फिर से स्वागत है! आपकी ₹${offer} की छूट लगा दी गई है।`,
    en: `Welcome back, ${first}! Your ₹${offer} offer has been applied.`,
  }),
  order: (first: string, amount: number): Say => ({
    kn: `${first} ಅವರಿಂದ WhatsApp ಆರ್ಡರ್ ಬಂದಿದೆ, ₹${amount}.`,
    hi: `${first} जी का WhatsApp ऑर्डर आया है, ₹${amount}।`,
    en: `New WhatsApp order from ${first}, ₹${amount}.`,
  }),
  regular: (first: string): Say => ({ kn: `${first} ಅವರೇ, ನಮಸ್ಕಾರ!`, hi: `नमस्ते ${first} जी!`, en: `Hello ${first}!` }),
  newFace: (): Say => ({ kn: "ಹೊಸ ಗ್ರಾಹಕರು — ಸ್ವಾಗತ!", hi: "नए ग्राहक — स्वागत है!", en: "A new customer — welcome!" }),
  hello: (): Say => ({
    kn: "ನಮಸ್ಕಾರ ಮಂಜುನಾಥ್ ಅವರೇ, ನಾನು ಪೆಹಚಾನ್. ನಿಮ್ಮ ಗ್ರಾಹಕರನ್ನು ನಾನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತೇನೆ.",
    hi: "नमस्ते मंजुनाथ जी, मैं पहचान हूँ। आपके ग्राहकों को मैं याद रखूँगी।",
    en: "Hello Manjunath, I'm Pehchaan. I'll remember your customers for you.",
  }),
};

/** Offer text when the full Gemini message isn't available (e.g. a phone hits a fresh server). */
export const offerText = (first: string, offer: number): Say => ({
  kn: `ನಮಸ್ಕಾರ ${first} ಅವರೇ! ತುಂಬಾ ದಿನಗಳಿಂದ ನಿಮ್ಮನ್ನು ನೋಡಿಲ್ಲ. ನಿಮಗಾಗಿ ₹${offer} ರಿಯಾಯಿತಿ, ಈ ವಾರ ಮಾತ್ರ. — ಮಂಜುನಾಥ್, ಶ್ರೀ ಮಂಜುನಾಥ ಸ್ಟೋರ್ಸ್`,
  hi: `नमस्ते ${first} जी! काफ़ी दिनों से आप नहीं आए। आपके लिए ₹${offer} की छूट, सिर्फ़ इस हफ़्ते। — मंजुनाथ, श्री मंजुनाथ स्टोर्स`,
  en: `Namaskara ${first}! We haven't seen you in a while — ₹${offer} off for you, this week only. — Manjunath, Sri Manjunatha Stores`,
});
