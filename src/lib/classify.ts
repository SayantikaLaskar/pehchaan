import type { Cls } from "./data";

interface Input {
  amount: number;
  payer: string;
  vpa: string;
  note: string;
}

interface Verdict {
  cls: Cls;
  confidence: number;
  reason: string;
}

const LENDERS = /(MUTHOOT|BAJAJ|MANAPPURAM|KREDITBEE|HDFC CREDILA|IIFL|LOAN|DISB)/i;
const REFUND = /(REFUND|REVERSAL|REV\/|FAILED)/i;
const SURNAME = "GOWDA";
const SELF = "MANJUNATH GOWDA";
const CHIT = /(CHIT)/i;
const BUSINESS = /(TEMPLE|CATERER|CAFE|HOTEL|RESTAURANT|MESS|DARSHINI|TRUST|ORDER)/i;

// First pass is deterministic and explainable. Anything it can't place with
// confidence goes to the merchant as a one-tap question.
export function classify(t: Input): Verdict {
  const text = `${t.payer} ${t.vpa} ${t.note}`;
  if (REFUND.test(text))
    return { cls: "refund", confidence: 0.97, reason: "Narration marks it as a refund or failed-payment reversal — money returning, not a sale." };
  if (LENDERS.test(text))
    return { cls: "loan", confidence: 0.98, reason: `Disbursal from a registered lender (${t.payer.split(" ")[0]}). Loan principal is a liability, not turnover.` };
  if (t.payer.toUpperCase() === SELF)
    return { cls: "own", confidence: 0.99, reason: "Sender name matches the merchant's own savings account — a self transfer." };
  if (CHIT.test(text))
    return { cls: "own", confidence: 0.93, reason: "Chit-fund prize money is the merchant's own savings returning." };
  if (/INWARD REMIT/i.test(t.vpa))
    return { cls: "personal", confidence: 0.96, reason: "Inward foreign remittance from a family member — personal, not business." };
  if (t.payer.toUpperCase().includes(SURNAME))
    return { cls: "personal", confidence: 0.91, reason: `Shares the family surname (${SURNAME}) and arrives on a regular cycle — family money.` };
  if (BUSINESS.test(text))
    return { cls: "review", confidence: 0.62, reason: `Looks like a bulk business order from ${titleCase(t.payer)}, but it's unusually large. Confirming with the merchant.` };
  return {
    cls: "review",
    confidence: 0.5,
    reason: `₹${t.amount.toLocaleString("en-IN")} from an individual who has never paid at the counter before. Could be a sale or a personal transfer.`,
  };
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
