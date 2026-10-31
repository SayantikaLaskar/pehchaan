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
  regular: (first: string): Say => ({ kn: `${first} ಅವರೇ, ನಮಸ್ಕಾರ!`, hi: `नमस्ते ${first} जी!`, en: `Hello ${first}!` }),
  newFace: (): Say => ({ kn: "ಹೊಸ ಗ್ರಾಹಕರು — ಸ್ವಾಗತ!", hi: "नए ग्राहक — स्वागत है!", en: "A new customer — welcome!" }),
  hello: (): Say => ({
    kn: "ನಮಸ್ಕಾರ ಮಂಜುನಾಥ್ ಅವರೇ, ನಾನು ಪೆಹಚಾನ್. ನಿಮ್ಮ ಗ್ರಾಹಕರನ್ನು ನಾನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತೇನೆ.",
    hi: "नमस्ते मंजुनाथ जी, मैं पहचान हूँ। आपके ग्राहकों को मैं याद रखूँगी।",
    en: "Hello Manjunath, I'm Pehchaan. I'll remember your customers for you.",
  }),
};
