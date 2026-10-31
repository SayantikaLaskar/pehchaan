// Consent, minimisation and retention rules. The product states principles; exact legal
// clauses (RBI, NPCI, DPDP, TRAI) should be confirmed with Paytm's compliance team.
import { DAY, TODAY, rng, type Customer } from "./sim";

export type ConsentStatus = "opted_in" | "not_opted_in" | "withdrawn" | "erased";

export const CONSENT_LABEL: Record<ConsentStatus, string> = {
  opted_in: "Opted in",
  not_opted_in: "Not opted in",
  withdrawn: "Withdrawn",
  erased: "Erased",
};

export const RETENTION_DAYS = 180; // raw payment rows; older ones are reduced to 4 summary numbers
export const OFFER_CAP_DAYS = 30; // at most one offer per customer per month

export interface Consent { status: ConsentStatus; since: number; channel: "Paytm app" | "Soundbox QR" }

const cache = new Map<string, Consent>();

/** Baseline consent captured when the customer opted in (simulated: ~80% opt in). */
export function baseConsent(c: Customer): Consent {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const r = rng(parseInt(c.id.slice(1), 10) * 7919 + 13);
  const opted = r() < 0.8;
  const since = Math.min(TODAY - DAY, c.joined + Math.floor(r() * 40) * DAY);
  const v: Consent = { status: opted ? "opted_in" : "not_opted_in", since, channel: r() < 0.7 ? "Paytm app" : "Soundbox QR" };
  cache.set(c.id, v);
  return v;
}

/** "aisha.p40@oksbi" → "aisha.p••@oksbi": enough to recognise, not enough to message. */
export function maskVpa(vpa: string) {
  const [local, handle] = vpa.split("@");
  if (!handle) return vpa;
  const keep = Math.max(2, Math.ceil(local.length * 0.6));
  return `${local.slice(0, keep)}${"•".repeat(Math.max(2, local.length - keep))}@${handle}`;
}

/** What the LLM is allowed to see for one message — no payment data, no UPI ID. */
export function llmPayload(firstName: string, usual: string, lastSeen: number, favourite: string, offer: number) {
  return { name: firstName, usual, lastSeen, favourite, offer };
}
