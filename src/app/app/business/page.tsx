"use client";

import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Composition } from "@/components/charts";
import { CountUp } from "@/components/motion";
import { useApp } from "@/components/Providers";
import { L, inr, useLive } from "@/lib/pehchaan/use";
import s from "./business.module.css";

// One place for every input. `src` marks the only sourced figure; everything else is an assumption.
const DEFAULTS = {
  merchants: 150, // lakh subscription merchants
  fit: 40, // % with repeat UPI customers (kirana, food, daily needs)
  adopt: 30, // % of those who turn on free Pehchaan
  pro: 8, // % of adopters on Pro
  price: 99, // ₹ / month
  offers: 8, // win-back offers per Pro merchant per month
  redeem: 25, // % redeemed
  fee: 3, // ₹ Paytm fee per redeemed offer
  churn: 2, // % monthly Soundbox churn (baseline)
  churnCut: 15, // % relative churn reduction among adopters
  rental: 100, // ₹ / month device rental
  margin: 15, // % kirana gross margin
};
type Inputs = typeof DEFAULTS;

const FIELDS: { k: keyof Inputs; label: string; unit: string; min: number; max: number; step: number; src?: string; group: string }[] = [
  { k: "merchants", label: "Paytm subscription merchants", unit: "lakh", min: 50, max: 300, step: 5, src: "~1.5 Cr at end of FY26 (Inc42)", group: "Reach" },
  { k: "fit", label: "With repeat UPI customers", unit: "%", min: 10, max: 80, step: 5, group: "Reach" },
  { k: "adopt", label: "Turn on free Pehchaan", unit: "%", min: 5, max: 80, step: 5, group: "Reach" },
  { k: "pro", label: "Upgrade to Pro", unit: "%", min: 1, max: 30, step: 1, group: "Revenue" },
  { k: "price", label: "Pro price", unit: "₹/mo", min: 49, max: 299, step: 10, group: "Revenue" },
  { k: "offers", label: "Offers per Pro merchant", unit: "/mo", min: 2, max: 30, step: 1, group: "Revenue" },
  { k: "redeem", label: "Offers redeemed", unit: "%", min: 5, max: 60, step: 5, group: "Revenue" },
  { k: "fee", label: "Paytm fee per redemption", unit: "₹", min: 0, max: 10, step: 1, group: "Revenue" },
  { k: "churn", label: "Soundbox churn (baseline)", unit: "%/mo", min: 0.5, max: 5, step: 0.5, group: "Retention" },
  { k: "churnCut", label: "Churn cut for adopters", unit: "%", min: 0, max: 50, step: 5, group: "Retention" },
  { k: "rental", label: "Device rental", unit: "₹/mo", min: 50, max: 300, step: 10, group: "Retention" },
  { k: "margin", label: "Kirana gross margin", unit: "%", min: 5, max: 30, step: 1, group: "Merchant" },
];

const CR = 1_00_00_000;
const cr = (n: number) => (n >= CR ? `₹${(n / CR).toFixed(n >= 100 * CR ? 0 : 1)} Cr` : L(n));
const num = (n: number) => (n >= 1_00_00_000 ? `${(n / 1_00_00_000).toFixed(1)} Cr` : n >= 1_00_000 ? `${(n / 1_00_000).toFixed(1)} L` : Math.round(n).toLocaleString("en-IN"));

export default function Business() {
  const [v, setV] = useState<Inputs>(DEFAULTS);
  const { winnable } = useLive();
  const { sent } = useApp();

  const m = useMemo(() => {
    const merchants = v.merchants * 1_00_000;
    const adopters = merchants * (v.fit / 100) * (v.adopt / 100);
    const pro = adopters * (v.pro / 100);
    const proRev = pro * v.price * 12;
    const redemptions = pro * v.offers * (v.redeem / 100) * 12;
    const offerRev = redemptions * v.fee;
    const devicesSaved = adopters * (v.churn / 100) * (v.churnCut / 100) * 12;
    const retained = devicesSaved * v.rental * 12;
    const appOpens = pro * v.offers * 12 * 0.4; // assume 40% of offers opened in the Paytm app
    return { merchants, adopters, pro, proRev, offerRev, retained, total: proRev + offerRev + retained, devicesSaved, redemptions, appOpens };
  }, [v]);

  // Merchant view, from this shop's own model output.
  const shop = useMemo(() => {
    const top = winnable.slice(0, v.offers);
    const back = top.length * (v.redeem / 100);
    const avgMonthly = top.reduce((a, x) => a + x.monthly, 0) / Math.max(1, top.length);
    const spend = back * avgMonthly;
    const profit = spend * (v.margin / 100) - v.offers * (v.redeem / 100) * 30 - v.price;
    return { back, avgMonthly, spend, profit };
  }, [winnable, v]);

  const parts = [
    { key: "pro", label: "Pro subscriptions", value: m.proRev, color: "var(--c-sale)" },
    { key: "fee", label: "Offer fees", value: m.offerRev, color: "var(--c-loan)" },
    { key: "ret", label: "Soundbox rentals retained", value: m.retained, color: "var(--c-own)" },
  ];
  const groups = [...new Set(FIELDS.map((f) => f.group))];

  return (
    <div className={s.page}>
      <section className={s.hero} data-in>
        <div>
          <span className={s.kL}>Annual value to Paytm</span>
          <b className={`mono ${s.big}`}><CountUp value={m.total} format={cr} duration={0.8} /></b>
          <span className={s.sub}>{num(m.adopters)} merchants on Pehchaan · {num(m.pro)} on Pro</span>
        </div>
        <div className={s.heroStats}>
          <div><span className={s.kL}>Pro subscriptions</span><b className="mono">{cr(m.proRev)}</b></div>
          <div><span className={s.kL}>Offer fees</span><b className="mono">{cr(m.offerRev)}</b></div>
          <div><span className={s.kL}>Rentals retained</span><b className="mono">{cr(m.retained)}</b><small>{num(m.devicesSaved)} Soundboxes kept / yr</small></div>
          <div><span className={s.kL}>Paytm app opens</span><b className="mono">{num(m.appOpens)}</b><small>from offers / yr</small></div>
        </div>
      </section>

      <section className={s.grid}>
        <div className="card" data-in>
          <div className="card-head">
            <div><div className="card-title">Assumptions</div><div className="card-sub">Drag to stress-test. Only the merchant base is sourced; the rest are our estimates.</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setV(DEFAULTS)}><RotateCcw size={13} />Reset</button>
          </div>
          <div className={s.fields}>
            {groups.map((g) => (
              <div key={g} className={s.group}>
                <span className={s.gLabel}>{g}</span>
                {FIELDS.filter((f) => f.group === g).map((f) => (
                  <label key={f.k} className={s.field}>
                    <span className={s.fTop}>
                      <span>{f.label}{f.src && <em title={f.src} className={s.src}><Info size={12} />sourced</em>}</span>
                      <b className="mono">{f.unit.startsWith("₹") ? `₹${v[f.k]}${f.unit.slice(1)}` : `${v[f.k]} ${f.unit}`}</b>
                    </span>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: +e.target.value })} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={s.side}>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Where the value comes from</div></div>
            <div className="card-body"><Composition parts={parts} fmt={cr} /></div>
          </div>
          <div className="card" data-in>
            <div className="card-head"><div><div className="card-title">For one merchant</div><div className="card-sub">Sri Manjunatha Stores, from its own model output</div></div></div>
            <div className={s.shop}>
              <div><span>Regulars won back / month</span><b className="mono">{shop.back.toFixed(1)}</b></div>
              <div><span>Their average spend</span><b className="mono">{inr(shop.avgMonthly)}/mo</b></div>
              <div><span>Spend recovered</span><b className="mono">{inr(shop.spend)}/mo</b></div>
              <div className={s.net}><span>Net profit after offers + Pro</span><b className={`mono ${shop.profit >= 0 ? s.pos : s.neg}`}>{shop.profit >= 0 ? "+" : "−"}{inr(Math.abs(shop.profit))}/mo</b></div>
            </div>
            <p className={s.foot}>At {v.margin}% margin, after ₹30 per redeemed offer and ₹{v.price} for Pro. {Object.keys(sent).length > 0 && `${Object.keys(sent).length} offers sent so far in this demo.`}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
