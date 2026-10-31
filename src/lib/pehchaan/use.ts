"use client";

import { useMemo } from "react";
import { useApp } from "@/components/Providers";
import { baseConsent, type ConsentStatus } from "./consent";
import { analyse, type Scored } from "./model";
import { network } from "./network";
import { DAY, TODAY } from "./sim";

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const L = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1_00_000) return `${s}₹${(a / 1_00_000).toFixed(2)}L`;
  if (a >= 1000) return `${s}₹${(a / 1000).toFixed(1)}k`;
  return `${s}₹${Math.round(a)}`;
};
export const gapText = (d: number) => (d < 1.5 ? "daily" : d < 9 ? `every ${Math.round(d)} days` : d < 20 ? "weekly" : "occasionally");

const FAV: Record<string, string> = { daily: "milk and vegetables", regular: "vegetables", weekly: "groceries", occasional: "fruits" };
export const favourite = (arch: string) => FAV[arch] ?? "vegetables";

type Pehchaan = ReturnType<typeof analyse> & {
  net: ReturnType<typeof network>;
  winnable: ReturnType<typeof analyse>["scored"];
  expectedToday: number;
  today: number;
  DAY: number;
};

let memo: Pehchaan | null = null;

// Everything is deterministic, so it's computed once and the same object is returned
// on every render — safe to use in effect dependencies.
export function usePehchaan(): Pehchaan {
  if (memo) return memo;
  const a = analyse();
  const net = network();
  const winnable = a.scored.filter((s) => s.winnable).sort((x, y) => y.priority - x.priority);
  const expectedToday = Math.round(a.scored.reduce((s, x) => s + x.next30, 0) / 30);
  memo = { ...a, net, winnable, expectedToday, today: TODAY, DAY };
  return memo;
}

/** Model output with the merchant's live consent state applied: erased customers disappear,
 *  and only opted-in customers are eligible for offers. */
export function useLive() {
  const base = usePehchaan();
  const { consent } = useApp();
  return useMemo(() => {
    const statusOf = (x: Scored): ConsentStatus => consent[x.c.id] ?? baseConsent(x.c).status;
    const scored = base.scored.filter((x) => statusOf(x) !== "erased");
    const winnable = base.winnable.filter((x) => statusOf(x) !== "erased");
    const eligible = winnable.filter((x) => statusOf(x) === "opted_in");
    return { ...base, scored, winnable, eligible, statusOf };
  }, [base, consent]);
}
