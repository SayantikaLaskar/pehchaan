"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Download, Lock, Server, ShieldCheck } from "lucide-react";
import { useApp, type Audit } from "@/components/Providers";
import { CONSENT_LABEL, OFFER_CAP_DAYS, RETENTION_DAYS, baseConsent, llmPayload, maskVpa, type ConsentStatus } from "@/lib/pehchaan/consent";
import { DAY, TODAY } from "@/lib/pehchaan/sim";
import { favourite, gapText, usePehchaan, useLive } from "@/lib/pehchaan/use";
import s from "./trust.module.css";

const RULES = [
  {
    rule: "RBI · Storage of Payment System Data (2018)",
    requires: "Payment system data is stored only in India.",
    does: ["Runs inside Paytm's India infrastructure; this demo's servers are pinned to Mumbai", "The language model never receives payment data — see below", "Older history stays in Paytm's regulated payment systems; Pehchaan keeps raw rows for 180 days"],
  },
  {
    rule: "Digital Personal Data Protection Act, 2023",
    requires: "Notice and consent, purpose limitation, minimisation, withdrawal and erasure.",
    does: ["Customers opt in from the Paytm app or the Soundbox QR", "Used only for this store's loyalty — nothing else", "UPI IDs masked everywhere; withdraw or erase in one tap; every action audited"],
  },
  {
    rule: "NPCI · UPI data-sharing norms",
    requires: "Payer data is not shared with third parties.",
    does: ["The merchant sees only what is already on their Paytm statement", "No phone numbers, ever", "Offers travel only through Paytm's own app"],
  },
  {
    rule: "TRAI · commercial communication rules",
    requires: "Promotional messages only with consent, with a way to opt out.",
    does: ["Only opted-in customers are messaged", `At most one offer per customer every ${OFFER_CAP_DAYS} days`, "Every offer carries an opt-out"],
  },
  {
    rule: "RBI · Digital Lending Directions (kept out of scope)",
    requires: "Credit decisions and data used for them fall under lending rules.",
    does: ["Pehchaan scores loyalty, not creditworthiness", "Scores are never used for credit or shared with lenders"],
  },
];

const FILTERS: (ConsentStatus | "all")[] = ["all", "opted_in", "not_opted_in", "withdrawn", "erased"];
const PER = 10;
const fmt = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16);

export default function Trust() {
  const base = usePehchaan();
  const { winnable } = useLive();
  const { consent, setConsent, audit, sent } = useApp();
  const [filter, setFilter] = useState<ConsentStatus | "all">("all");
  const [page, setPage] = useState(0);

  const statusOf = (id: string, c: (typeof base.scored)[number]["c"]) => consent[id] ?? baseConsent(c).status;
  const ledger = useMemo(() => base.scored.map((x) => ({ x, status: statusOf(x.c.id, x.c), base: baseConsent(x.c) })), [base, consent]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ledger.length };
    for (const r of ledger) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [ledger]);
  const rows = ledger.filter((r) => filter === "all" || r.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const sentThisMonth = Object.values(sent).filter((v) => Date.now() - v.at < OFFER_CAP_DAYS * DAY).length;

  // A real payload: exactly what would leave Paytm for the top win-back candidate.
  const top = winnable[0];
  const payload = top ? llmPayload(top.c.name.split(" ")[0], gapText(top.avgGap), Math.round(top.lastSeen), favourite(top.c.archetype), 30) : null;

  const system: Audit[] = [
    { t: TODAY - 22 * 3600_000, actor: "System", action: "Nightly refit", detail: `${base.scored.length} customers scored · model fitted in Mumbai region` },
    { t: TODAY - 22 * 3600_000 + 60_000, actor: "System", action: "Retention sweep", detail: `Raw payment rows older than ${RETENTION_DAYS} days reduced to 4 summary numbers per customer` },
    { t: TODAY - 21 * 3600_000, actor: "System", action: "Consent sync", detail: `${counts.opted_in ?? 0} opted in via Paytm app / Soundbox QR` },
  ];
  const nameOf = (id?: string) => {
    if (!id) return "—";
    const st = consent[id];
    if (st === "erased") return `Erased customer ${id}`;
    return base.scored.find((x) => x.c.id === id)?.c.name ?? id;
  };
  const log = [...audit, ...system];

  const exportAudit = () => {
    const csv = ["time,actor,action,customer,detail", ...log.map((e) => [fmt(e.t), e.actor, e.action, `"${nameOf(e.subject)}"`, `"${e.detail.replace(/"/g, "'")}"`].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "pehchaan-audit-log.csv";
    a.click();
  };

  return (
    <div className={s.page}>
      <section className={s.kpis}>
        <K icon={<BadgeCheck size={16} />} k="Customers opted in" v={`${counts.opted_in ?? 0} of ${ledger.length - (counts.erased ?? 0)}`} sub="only they can receive offers" />
        <K icon={<ShieldCheck size={16} />} k="Offers in last 30 days" v={String(sentThisMonth)} sub={`cap: 1 per customer per ${OFFER_CAP_DAYS} days`} />
        <K icon={<Server size={16} />} k="Where data is processed" v="India" sub="Mumbai region · no payment data to the LLM" />
        <K icon={<Lock size={16} />} k="Raw payment rows kept" v={`${RETENTION_DAYS} days`} sub="then 4 summary numbers per customer" />
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div>
            <div className="card-title">Rules we design for</div>
            <div className="card-sub">Principles built into the product — exact clauses to be confirmed with Paytm&apos;s compliance team</div>
          </div>
        </div>
        <div className={s.rules}>
          {RULES.map((r) => (
            <div key={r.rule} className={s.rule}>
              <div className={s.ruleHead}><b>{r.rule}</b><span className="badge badge-good"><BadgeCheck />Built in</span></div>
              <p className={s.req}>{r.requires}</p>
              <ul>{r.does.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className={s.two}>
        <div className="card" data-in>
          <div className="card-head"><div><div className="card-title">What stays inside Paytm</div><div className="card-sub">India region · used only to score loyalty</div></div></div>
          <ul className={s.stays}>
            {["Payment amount, date and time", "Full name and UPI ID", "Visit history and household links", "Probability of still being a regular", "90-day value and segment"].map((x) => <li key={x}><Lock size={14} />{x}</li>)}
          </ul>
        </div>
        <div className="card" data-in>
          <div className="card-head"><div><div className="card-title">What the language model sees</div><div className="card-sub">The exact payload for this week&apos;s top win-back — nothing else</div></div></div>
          <pre className={s.payload}>{payload ? JSON.stringify(payload, null, 2) : "{}"}</pre>
          <p className={s.note}>First name only. No amount, no UPI ID, no history. Gemini writes the words; the model decides who and how much.</p>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div><div className="card-title">Consent ledger</div><div className="card-sub">Captured from the Paytm app and Soundbox QR · customers can withdraw any time</div></div>
        </div>
        <div className={s.filters}>
          {FILTERS.map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => { setFilter(f); setPage(0); }}>
              {f === "all" ? "All" : CONSENT_LABEL[f]}<small>{counts[f] ?? 0}</small>
            </button>
          ))}
        </div>
        <div className={s.th}><span>Customer</span><span>Status</span><span>Channel</span><span>Since</span><span /></div>
        {rows.slice(page * PER, page * PER + PER).map(({ x, status, base: b }) => (
          <div key={x.c.id} className={s.tr}>
            <span className={s.who}>
              {status === "erased" ? <b className="t3">Erased customer {x.c.id}</b> : <><b>{x.c.name}</b><small className="mono">{maskVpa(x.c.vpa)}</small></>}
            </span>
            <span><span className={`badge ${status === "opted_in" ? "badge-good" : status === "withdrawn" ? "badge-warn" : ""}`}>{CONSENT_LABEL[status]}</span></span>
            <span className="t2">{status === "not_opted_in" || status === "erased" ? "—" : b.channel}</span>
            <span className="mono t2">{status === "not_opted_in" || status === "erased" ? "—" : fmt(b.since).slice(0, 10)}</span>
            <span className={s.act}>
              {status === "opted_in" && <button className="btn btn-ghost btn-sm" onClick={() => setConsent(x.c.id, "withdrawn")}>Withdraw</button>}
              {status !== "erased" && <button className="btn btn-ghost btn-sm" onClick={() => setConsent(x.c.id, "erased", x.c.name)}>Erase</button>}
            </span>
          </div>
        ))}
        <div className={s.foot}>
          <span className="t3">{rows.length} customers</span>
          <div className={s.pager}>
            <span className="t3">Page {page + 1} of {pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
            <button className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next"><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      <section className="card" data-in>
        <div className="card-head">
          <div><div className="card-title">Audit log</div><div className="card-sub">Every agent action, consent change and data operation — who, what, why</div></div>
          <button className="btn btn-secondary btn-sm" onClick={exportAudit}><Download size={14} />Export CSV</button>
        </div>
        <div className={`${s.th} ${s.auditGrid}`}><span>Time (UTC)</span><span>Actor</span><span>Action</span><span>Customer</span><span>Detail</span></div>
        {log.slice(0, 40).map((e, i) => (
          <div key={i} className={`${s.tr} ${s.auditGrid}`}>
            <span className="mono t3">{fmt(e.t)}</span>
            <span><span className={`badge ${e.actor === "Agent" ? "badge-info" : e.actor === "Customer" ? "badge-good" : ""}`}>{e.actor}</span></span>
            <span>{e.action}</span>
            <span className="t2">{nameOf(e.subject)}</span>
            <span className="t2">{e.detail}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function K({ icon, k, v, sub }: { icon: React.ReactNode; k: string; v: string; sub: string }) {
  return (
    <div className="card" data-in>
      <span className={s.kL}>{icon}{k}</span>
      <b>{v}</b>
      <small>{sub}</small>
    </div>
  );
}
