"use client";

import { BrainCircuit, Calculator, Database, MessageSquareText, Target } from "lucide-react";
import { GroupedBars } from "@/components/charts";
import { CountUp } from "@/components/motion";
import { dMedium } from "@/lib/format";
import { CAL_END, HOLD_END } from "@/lib/pehchaan/model";
import { customers } from "@/lib/pehchaan/sim";
import { gapText, usePehchaan } from "@/lib/pehchaan/use";
import cdnow from "@/lib/pehchaan/cdnow-validation.json";
import comparison from "@/lib/pehchaan/model-comparison.json";
import s from "./model.module.css";

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export default function Model() {
  const { backtest: b, bg, gg, scored } = usePehchaan();
  const payments = customers().reduce((a, c) => a + c.visits.length, 0);
  const err = (b.predicted - b.actual) / b.actual;
  const ex = scored.filter((x) => x.segment === "at_risk").sort((x, y) => y.monthly - x.monthly)[0];

  return (
    <div className={s.page}>
      <section className={`card ${s.hero}`} data-in>
        <div>
          <span className="badge badge-info"><BrainCircuit />Probabilistic model · not an LLM</span>
          <h2>Every number here comes from a statistical model fitted to <span className="mono">{payments.toLocaleString("en-IN")}</span> UPI payments.</h2>
          <p>A kirana regular never cancels — they just stop coming. Pehchaan uses MBG/NBD — an improved BG/NBD (Batislam et al., 2007; Fader, Hardie &amp; Lee, 2005) that also lets one-visit customers drop out — plus Gamma-Gamma for spend. We picked it by testing four approaches out of sample, below.</p>
        </div>
        <ul className={s.pipeline}>
          <li><Database size={16} /><span><b>Input</b>For each UPI ID: how often they paid, when they last paid, how long they&apos;ve been a customer</span></li>
          <li><Calculator size={16} /><span><b>MBG/NBD</b>Probability they&apos;re still a regular, and how many visits to expect next</span></li>
          <li><Target size={16} /><span><b>Gamma-Gamma</b>How much they&apos;ll spend per visit → 90-day value</span></li>
          <li><MessageSquareText size={16} /><span><b>LLM (Gemini)</b>Only writes the Kannada messages. It never decides who or how much.</span></li>
        </ul>
      </section>

      <section className={s.metrics}>
        <M k="Visits predicted" v={b.predicted} f={(n) => Math.round(n).toLocaleString("en-IN")} sub={`for ${b.n} customers, ${dMedium(iso(CAL_END))} – ${dMedium(iso(HOLD_END))}`} />
        <M k="Visits that happened" v={b.actual} f={(n) => Math.round(n).toLocaleString("en-IN")} sub={`${err >= 0 ? "+" : ""}${(err * 100).toFixed(1)}% total error`} good />
        <M k="Per-customer correlation" v={b.corr} f={(n) => n.toFixed(2)} sub={`mean abs. error ${b.mae.toFixed(1)} visits`} />
        <M k="Top 10% by model" v={b.topDecileCapture * 100} f={(n) => `${Math.round(n)}%`} sub="of all holdout visits came from them" />
      </section>

      <section className={s.two}>
        <div className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Backtest on months the model never saw</div>
              <div className="card-sub">Trained on payments up to {dMedium(iso(CAL_END))} · average visits per customer in the next {Math.round((HOLD_END - CAL_END) / 86400000)} days, grouped by how often they had visited before</div>
            </div>
            <div className={s.legend}><span><i style={{ background: "var(--border-strong)" }} />Predicted</span><span><i style={{ background: "var(--c-sale)" }} />Actual</span></div>
          </div>
          <div className="card-body">
            <GroupedBars groups={b.buckets.map((x) => ({ label: `${x.label}`, a: x.predicted, b: x.actual }))} names={["Predicted", "Actual"]} fmt={(n) => n.toFixed(1)} />
            <p className={s.axis}>Past repeat visits before {dMedium(iso(CAL_END))} →</p>
          </div>
        </div>

        <div className="card" data-in>
          <div className="card-head"><div className="card-title">What the model learned</div><span className="card-sub">fitted by maximum likelihood</span></div>
          <div className={s.params}>
            <P k="Typical visit rate" v={`${((bg.r / bg.alpha) * 7).toFixed(2)} / week`} d={`r = ${bg.r.toFixed(2)}, α = ${bg.alpha.toFixed(2)}`} />
            <P k="Chance of leaving after any visit" v={`${((bg.a / (bg.a + bg.b)) * 100).toFixed(1)}%`} d={`a = ${bg.a.toFixed(2)}, b = ${bg.b.toFixed(1)}`} />
            <P k="Average basket" v={`₹${Math.round((gg.p * gg.v) / (gg.q - 1))}`} d={`p = ${gg.p.toFixed(1)}, q = ${gg.q.toFixed(2)}, γ = ${gg.v.toFixed(1)}`} />
            <P k="Customers scored" v={String(scored.length)} d="refit nightly from Soundbox payments" />
          </div>
          {ex && (
            <div className={s.example}>
              <span className={s.exLabel}>Worked example</span>
              <p><b>{ex.c.name}</b> paid {ex.rfm.x + 1} times, {gapText(ex.avgGap)}, then nothing for <b>{Math.round(ex.lastSeen)} days</b>. For someone this regular, that silence is unusual — so the probability they&apos;re still a regular falls to <b>{Math.round(ex.pAlive * 100)}%</b> (it was {Math.round(ex.pAlive30 * 100)}% a month ago). An occasional customer with the same silence would barely move.</p>
            </div>
          )}
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Why this model — tested against simple rules</div>
            <div className="card-sub">Out of sample on both datasets · AUC = how well it ranks the customers who made no visits in the test period (0.5 = random, 1 = perfect) · reproduce: <span className="mono">npx tsx scripts/compare-models.ts</span></div>
          </div>
          <span className="badge badge-good">MBG/NBD selected</span>
        </div>
        <div className={s.cmp}>
          <table className={s.ptable}>
            <thead><tr><th>Approach</th>{comparison.map((d) => <th key={d.name} colSpan={2}>{d.name}</th>)}</tr><tr><th /><th>AUC</th><th>Forecast error</th><th>AUC</th><th>Forecast error</th></tr></thead>
            <tbody>
              {comparison[0].models.map((m, i) => {
                const chosen = m.model === "MBG/NBD · ranked by expected visits";
                return (
                  <tr key={m.model} className={chosen ? s.chosen : ""}>
                    <td>{m.model}{chosen && " ✓"}</td>
                    {comparison.map((d) => {
                      const x = d.models[i];
                      return [<td key={d.name + "a"} className="mono">{x.auc.toFixed(2)}</td>, <td key={d.name + "m"} className="mono">{x.mae == null ? "—" : `${x.mae.toFixed(2)} visits`}</td>];
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={s.realNote}>Plain BG/NBD assumes a one-time buyer is still a customer, which fails on real data where most people buy once (CDNOW AUC 0.32 — worse than random). MBG/NBD fixes that, and ranking by expected visits gives the best &ldquo;who left&rdquo; signal on both datasets while keeping forecast error less than half the simple rate rule&apos;s.</p>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Validated on real purchase data</div>
            <div className="card-sub">{cdnow.dataset} — the dataset from the original BG/NBD paper · {cdnow.source}</div>
          </div>
          <span className="badge badge-good">Real data</span>
        </div>
        <div className={s.real}>
          <table className={s.ptable}>
            <thead><tr><th>Parameter</th><th>Our fit</th><th>Published</th><th>Difference</th></tr></thead>
            <tbody>
              {(["r", "alpha", "a", "b"] as const).map((k) => (
                <tr key={k}>
                  <td className="mono">{k === "alpha" ? "α" : k}</td>
                  <td className="mono">{cdnow.ours[k].toFixed(3)}</td>
                  <td className="mono">{cdnow.published[k].toFixed(3)}</td>
                  <td className="mono">{(((cdnow.ours[k] - cdnow.published[k]) / cdnow.published[k]) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.realChart}>
            <GroupedBars groups={cdnow.buckets.map((x) => ({ label: x.label, a: x.predicted, b: x.actual }))} names={["Predicted", "Actual"]} fmt={(n) => n.toFixed(1)} height={200} />
            <p className={s.axis}>Repeat purchases in weeks 1–39 → average purchases in unseen weeks 40–78</p>
          </div>
        </div>
        <p className={s.realNote}>Our maximum-likelihood fit recovers the published parameters within 3%. On the 39 unseen weeks it predicted {Math.round(cdnow.holdout.predicted).toLocaleString("en-IN")} repeat purchases against {cdnow.holdout.actual.toLocaleString("en-IN")} actual ({Math.round(((cdnow.holdout.predicted - cdnow.holdout.actual) / cdnow.holdout.actual) * 100)}%) — real data is noisier than our demo shop, which is why the pilot measures accuracy on Paytm&apos;s own payments. Reproduce: <span className="mono">npx tsx scripts/validate-cdnow.ts</span></p>
      </section>
    </div>
  );
}

function M({ k, v, f, sub, good }: { k: string; v: number; f: (n: number) => string; sub: string; good?: boolean }) {
  return (
    <div className="card" data-in>
      <span className={s.kL}>{k}</span>
      <b className={`mono ${good ? s.good : ""}`}><CountUp value={v} format={f} /></b>
      <small>{sub}</small>
    </div>
  );
}

function P({ k, v, d }: { k: string; v: string; d: string }) {
  return <div className={s.param}><span>{k}</span><b>{v}</b><small className="mono">{d}</small></div>;
}
