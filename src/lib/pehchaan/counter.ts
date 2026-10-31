"use client";
// A customer pays at the counter. If the agent sent them an offer, it is applied right there, matched
// by their UPI ID — no app, no link, no data on the customer's phone. This is what makes offers work
// for feature phones and zero-network villages: the offer lives with the shop, not with the phone.
import { useCallback } from "react";
import { useApp } from "@/components/Providers";
import { post } from "@/lib/outbox";
import { lines } from "./i18n";
import type { Scored } from "./model";

export function useCounter() {
  const { sent, markReturned, log, speak } = useApp();
  return useCallback((x: Scored, amount: number) => {
    const first = x.c.name.split(" ")[0];
    const offer = sent[x.c.id];
    if (offer && offer.returned == null) {
      markReturned(x.c.id, true);
      log({ actor: "System", action: "Offer applied at Soundbox", subject: x.c.id, detail: `₹${offer.offer} off ₹${amount}, matched by UPI ID — no app or data needed on the customer's phone` });
      if (offer.code) post(`/api/offers/${offer.code}`, { action: "redeem" });
      speak(lines.applied(first, offer.offer));
      return { applied: offer.offer, paid: Math.max(0, amount - offer.offer) };
    }
    speak(lines.back(first, Math.round(x.lastSeen)));
    return { applied: 0, paid: amount };
  }, [sent, markReturned, log, speak]);
}
