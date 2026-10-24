"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { dLong, dShort } from "@/lib/format";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronLeft, ChevronRight, Download, FileCheck2, Search, Sparkles, X } from "lucide-react";
import { useApp } from "@/components/Providers";
import type { Cls, Txn } from "@/lib/data";
import { CLS_META, inr, resolved } from "@/lib/gst";
import { L, useLedger } from "@/lib/useLedger";
import s from "./tx.module.css";

const FILTERS: (Cls | "all")[] = ["all", "sale", "personal", "loan", "own", "refund", "review"];
const PER = 20;

export default function Page() {
  return <Suspense><Transactions /></Suspense>;
}

function Transactions() {
  const { txns, fy, answers, sum } = useLedger();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Cls | "all">("all");
  const [counter, setCounter] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Txn | null>(null);

  useEffect(() => {
    const id = params.get("id");
    if (id) setOpen(txns.find((t) => t.id === id) ?? null);
  }, [params, txns]);

  const rows = useMemo(() => {
    const a = fy.start.toISOString().slice(0, 10), b = fy.end.toISOString().slice(0, 10);
    const ql = q.toLowerCase();
    return txns.filter((t) => {
      if (t.date < a || t.date > b) return false;
      if (!counter && t.count) return false;
      if (filter !== "all" && resolved(t, answers) !== filter) return false;
      return !ql || (t.payer + t.vpa + t.note + t.amount).toLowerCase().includes(ql);
    });
  }, [txns, fy, q, filter, counter, answers]);

  useEffect(() => setPage(0), [q, filter, counter, fy]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const slice = rows.slice(page * PER, page * PER + PER);
  const total = rows.reduce((a, t) => a + t.amount, 0);

  const exportCsv = () => {
    const csv = ["date,payer,vpa,note,amount,category,reason", ...rows.map((t) => [t.date, t.payer, t.vpa, t.note, t.amount, resolved(t, answers), `"${t.reason.replace(/"/g, "'")}"`].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = `kavach-${fy.label.replace(/\s/g, "")}.csv`;
    el.click();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const k of FILTERS) c[k] = 0;
    const a = fy.start.toISOString().slice(0, 10), b = fy.end.toISOString().slice(0, 10);
    for (const t of txns) {
      if (t.date < a || t.date > b || (!counter && t.count)) continue;
      c.all++;
      c[resolved(t, answers)]++;
    }
    return c;
  }, [txns, fy, counter, answers]);

  return (
    <div className={s.page}>
      <div className={`card ${s.table}`} data-in>
        <div className={s.toolbar}>
          <div className={s.searchBox}>
            <Search size={15} className="t3" />
            <input className={s.searchInput} placeholder="Search payer, VPA, note or amount" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className={s.filters}>
            {FILTERS.map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={s.fbtn}>
                {f !== "all" && <i style={{ background: CLS_META[f].tone }} />}
                {f === "all" ? "All" : CLS_META[f].short}
                <small>{counts[f]}</small>
              </button>
            ))}
          </div>
          <div className={s.tools}>
            <label className={s.toggle}>
              <input type="checkbox" checked={counter} onChange={(e) => setCounter(e.target.checked)} />
              <span />Daily QR sales
            </label>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Download size={14} />Export</button>
          </div>
        </div>

        <div className={s.thead}>
          <span>Date</span><span>Payer</span><span>Why Kavach decided this</span><span>Category</span><span className={s.r}>Amount</span>
        </div>
        <div className={s.tbody}>
          {slice.map((t) => {
            const c = resolved(t, answers);
            const overridden = answers[t.id] && answers[t.id] !== t.cls;
            return (
              <button key={t.id} className={`${s.tr} ${open?.id === t.id ? s.trOn : ""}`} onClick={() => setOpen(t)}>
                <span className="mono t3">{dShort(t.date)}</span>
                <span className={s.payer}>
                  <span className={s.av} style={{ background: `color-mix(in srgb, ${CLS_META[c].tone} 14%, white)`, color: CLS_META[c].tone }}>{t.payer.slice(0, 1)}</span>
                  <span><b>{t.payer}</b><small className="mono">{t.count ? `${t.count} payments via QR` : t.vpa}</small></span>
                </span>
                <span className={s.reason}>{t.count ? "Counter sales — many unique payers, shop hours, small tickets." : answers[t.id] ? "Confirmed by merchant on Soundbox." : t.reason}</span>
                <span><span className="badge"><span className="sw" style={{ background: CLS_META[c].tone }} />{CLS_META[c].short}{overridden && <Sparkles size={11} />}</span></span>
                <span className={`mono ${s.r} ${s.amt}`}>+{inr(t.amount)}</span>
              </button>
            );
          })}
          {slice.length === 0 && <div className={s.empty}>No transactions match.</div>}
        </div>

        <div className={s.foot}>
          <span className="t3">{rows.length.toLocaleString("en-IN")} rows · <span className="mono">{L(total)}</span>{!counter && ` · ${sum.counts.sale.toLocaleString("en-IN")} QR sales hidden`}</span>
          <div className={s.pager}>
            <span className="t3">Page {page + 1} of {pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
            <button className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {open && <Drawer t={open} onClose={() => { setOpen(null); if (params.get("id")) router.replace("/app/transactions"); }} />}
    </div>
  );
}

function Drawer({ t, onClose }: { t: Txn; onClose: () => void }) {
  const { answers, answer } = useApp();
  const c = resolved(t, answers);
  const panel = useRef<HTMLDivElement>(null);
  useGSAP(() => { gsap.fromTo(panel.current, { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: "expo.out" }); }, { dependencies: [t.id] });
  const signals = t.count
    ? ["Many unique payers in one day", "Inside shop hours (6am–10pm)", "Median ticket under ₹300"]
    : [t.vpa.startsWith("NEFT") ? "Bank transfer (NEFT), not a QR scan" : t.vpa.includes("@") ? "UPI handle of an individual" : "Bank-initiated credit", t.note ? `Narration: “${t.note}”` : "No narration", `Amount ${t.amount >= 15000 ? "far above" : "near"} the shop's median ticket`];
  const evidence: Record<Cls, string> = {
    sale: "Paytm QR settlement report",
    personal: "Bank statement + sender relationship confirmed",
    loan: "Lender disbursal letter (auto-matched)",
    own: "Own-account statement",
    refund: "Original payment + reversal reference",
    review: "Waiting for merchant's answer",
  };
  return (
    <div className={s.drawerBg} onClick={onClose}>
      <aside className={s.drawer} ref={panel} onClick={(e) => e.stopPropagation()}>
        <header className={s.dHead}>
          <span className="t3">Transaction · {t.id}</span>
          <button className={s.close} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className={s.dAmt}>
          <span className="mono">+{inr(t.amount)}</span>
          <span className="t3">{t.payer} · {dLong(t.date)}</span>
        </div>
        <div className={s.dSec}>
          <span className={s.dLabel}>Classification</span>
          <div className={s.dRow}>
            <span className="badge"><span className="sw" style={{ background: CLS_META[c].tone }} />{CLS_META[c].label}</span>
            <span className="mono t3">{Math.round((answers[t.id] ? 1 : t.confidence) * 100)}% confidence</span>
          </div>
          <div className={s.conf}><span style={{ width: `${(answers[t.id] ? 1 : t.confidence) * 100}%` }} /></div>
          <p className={s.dReason}>{t.count ? "Counter sales via Paytm QR — many unique payers, shop hours, small tickets." : t.reason}</p>
        </div>
        <div className={s.dSec}>
          <span className={s.dLabel}>Signals</span>
          <ul className={s.signals}>{signals.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className={s.dSec}>
          <span className={s.dLabel}>Evidence for an officer</span>
          <div className={s.evidence}><FileCheck2 size={16} />{evidence[c]}</div>
        </div>
        <div className={s.dSec}>
          <span className={s.dLabel}>Reclassify</span>
          <div className={s.reclass}>
            {(["sale", "personal", "loan", "own", "refund"] as const).map((k) => (
              <button key={k} aria-pressed={c === k} onClick={() => answer(t.id, k)}>
                <i style={{ background: CLS_META[k].tone }} />{CLS_META[k].short}
              </button>
            ))}
          </div>
          <p className="t3" style={{ fontSize: 12, marginTop: 8 }}>Changes update turnover, forecasts and notice replies instantly.</p>
        </div>
      </aside>
    </div>
  );
}
