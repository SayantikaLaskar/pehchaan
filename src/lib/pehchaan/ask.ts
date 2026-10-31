// Answers the shopkeeper's spoken questions from the model — no LLM, so answers are exact.
import type { Say } from "./i18n";
import type { Scored } from "./model";

export type Intent = "slipping" | "today" | "best" | "money" | "offers" | "help";

const RULES: [Intent, RegExp][] = [
  ["slipping", /ಬಂದಿಲ್ಲ|ಬರ್ತಿಲ್ಲ|ಬರುತ್ತಿಲ್ಲ|नहीं आ|नही आ|nahi aa|hasn'?t|haven'?t|not come|slipping|missing|stopped/i],
  ["money", /ಹಣ|ದುಡ್ಡು|ನಷ್ಟ|पैसा|पैसे|नुकसान|money|spend|risk|losing|lose/i],
  ["offers", /ಆಫರ್|ವಾಪಸ್|ऑफ़र|ऑफर|वापस|offer|won back|came back|returned/i],
  ["best", /ಉತ್ತಮ|ಒಳ್ಳೆಯ|ಹೆಚ್ಚು|सबसे|अच्छे|best|top|loyal|champion/i],
  ["today", /ಇವತ್ತು|ಇಂದು|ಎಷ್ಟು|आज|कितने|today|how many|expect/i],
];

export const QUESTIONS: Record<"slipping" | "today" | "best" | "money", Say> = {
  slipping: { kn: "ಈ ವಾರ ಯಾರು ಬಂದಿಲ್ಲ?", hi: "इस हफ़्ते कौन नहीं आया?", en: "Who hasn't come this week?" },
  today: { kn: "ಇವತ್ತು ಎಷ್ಟು ಜನ ಬರಬಹುದು?", hi: "आज कितने ग्राहक आएँगे?", en: "How many customers today?" },
  best: { kn: "ನನ್ನ ಉತ್ತಮ ಗ್ರಾಹಕರು ಯಾರು?", hi: "मेरे सबसे अच्छे ग्राहक कौन हैं?", en: "Who are my best customers?" },
  money: { kn: "ಎಷ್ಟು ಹಣ ನಷ್ಟ ಆಗ್ತಿದೆ?", hi: "कितना पैसा जा रहा है?", en: "How much money am I losing?" },
};

export const intentOf = (q: string): Intent => RULES.find(([, re]) => re.test(q))?.[0] ?? "help";

const first = (x: Scored) => x.c.name.split(" ")[0];
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

export function answer(intent: Intent, ctx: { winnable: Scored[]; scored: Scored[]; expectedToday: number; sentCount: number; backCount: number }): Say {
  switch (intent) {
    case "slipping": {
      const top = ctx.winnable.slice(0, 3).map((x) => [first(x), Math.round(x.lastSeen)] as const);
      return {
        kn: `ಬಂದಿಲ್ಲದವರು: ${top.map(([n, d]) => `${n} ${d} ದಿನ`).join(", ")}. ಅವರಿಗೆ ಆಫರ್ ಕಳುಹಿಸಲೇ?`,
        hi: `जो नहीं आए: ${top.map(([n, d]) => `${n} ${d} दिन`).join(", ")}। उन्हें ऑफ़र भेजूँ?`,
        en: `Not seen lately: ${top.map(([n, d]) => `${n}, ${d} days`).join("; ")}. Shall I send them an offer?`,
      };
    }
    case "today":
      return {
        kn: `ಇವತ್ತು ಸುಮಾರು ${ctx.expectedToday} ಗ್ರಾಹಕರು ಬರುವ ನಿರೀಕ್ಷೆ.`,
        hi: `आज लगभग ${ctx.expectedToday} ग्राहक आने की उम्मीद है।`,
        en: `About ${ctx.expectedToday} customers are expected today.`,
      };
    case "best": {
      const top = ctx.scored.filter((x) => x.segment === "champion").sort((a, b) => b.clv90 - a.clv90).slice(0, 3).map(first);
      return {
        kn: `ನಿಮ್ಮ ಉತ್ತಮ ಗ್ರಾಹಕರು: ${top.join(", ")}. ಅವರು ನಿಯಮಿತವಾಗಿ ಬರುತ್ತಿದ್ದಾರೆ.`,
        hi: `आपके सबसे अच्छे ग्राहक: ${top.join(", ")}। ये नियमित आ रहे हैं।`,
        en: `Your best customers are ${top.join(", ")}. They're coming regularly.`,
      };
    }
    case "money": {
      const m = ctx.winnable.reduce((a, x) => a + x.monthly, 0);
      return {
        kn: `ಬಿಟ್ಟು ಹೋಗುತ್ತಿರುವ ${ctx.winnable.length} ಗ್ರಾಹಕರಿಂದ ತಿಂಗಳಿಗೆ ಸುಮಾರು ₹${k(m)} ವ್ಯಾಪಾರ ಕಡಿಮೆ ಆಗ್ತಿದೆ.`,
        hi: `छोड़ रहे ${ctx.winnable.length} ग्राहकों से हर महीने लगभग ₹${k(m)} का कारोबार कम हो रहा है।`,
        en: `${ctx.winnable.length} customers slipping away spend about ₹${k(m)} a month.`,
      };
    }
    case "offers":
      return {
        kn: `${ctx.sentCount} ಆಫರ್ ಕಳುಹಿಸಲಾಗಿದೆ, ${ctx.backCount} ಜನ ವಾಪಸ್ ಬಂದಿದ್ದಾರೆ.`,
        hi: `${ctx.sentCount} ऑफ़र भेजे गए, ${ctx.backCount} लोग वापस आए।`,
        en: `${ctx.sentCount} offers sent, ${ctx.backCount} customers came back.`,
      };
    default:
      return {
        kn: "ಯಾರು ಬಂದಿಲ್ಲ, ಇವತ್ತು ಎಷ್ಟು ಜನ ಬರಬಹುದು, ಉತ್ತಮ ಗ್ರಾಹಕರು ಅಥವಾ ಹಣದ ಬಗ್ಗೆ ಕೇಳಿ.",
        hi: "पूछिए: कौन नहीं आया, आज कितने ग्राहक आएँगे, सबसे अच्छे ग्राहक, या कितना पैसा जा रहा है।",
        en: "Ask who hasn't come, how many customers to expect, your best customers, or money at risk.",
      };
  }
}
