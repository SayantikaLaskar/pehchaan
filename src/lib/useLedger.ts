"use client";

import { useMemo } from "react";
import { useApp } from "@/components/Providers";
import { FY_CURR, FY_PREV, getData } from "./data";
import { forecast, inr, monthly, summarize } from "./gst";

export const L = (n: number) => inr(n, { compact: true });

export function useLedger() {
  const { answers, fy: fyKey } = useApp();
  const { txns, purchases } = getData();
  const fy = fyKey === "curr" ? FY_CURR : FY_PREV;
  return useMemo(() => {
    const sum = summarize(txns, purchases, fy, answers);
    const prevSum = summarize(txns, purchases, FY_PREV, answers);
    const fc = forecast(txns, answers);
    const months = monthly(txns, fy, answers);
    const pending = txns.filter((t) => t.cls === "review" && !answers[t.id]);
    return { txns, purchases, fy, fyKey, sum, prevSum, fc, months, pending, answers };
  }, [txns, purchases, fy, fyKey, answers]);
}
