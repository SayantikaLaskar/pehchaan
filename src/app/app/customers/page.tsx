"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronLeft, ChevronRight, Search, Send, X } from "lucide-react";
import { DecayChart } from "@/components/charts";
import { useApp } from "@/components/Providers";
import { SEGMENTS, aliveCurve, type Scored, type Segment } from "@/lib/pehchaan/model";
import { dMedium } from "@/lib/format";
import { CONSENT_LABEL, baseConsent, maskVpa } from "@/lib/pehchaan/consent";
import { gapText, inr, useLive, usePehchaan } from "@/lib/pehchaan/use";
import s from "./customers.module.css";

const PER = 15;
type Sort = "priority" | "value" | "alive" | "recent";

export default function Page() {
  return <Suspense><Customers /></Suspense>;
}

function Customers() {
  const { scored } = useLive();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Segment | "all">("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Scored | null>(null);

  useEffect(() => {
    const id = params.get("id");
    if (id) setOpen(scored.find((x) => x.c.id === id) ?? null);
  }, [params, scored]);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const r = scored.filter((x) => (seg === "all" || x.segment === seg) && (!ql || x.c.name.toLowerCase().includes(ql)));
    const key: Record<Sort, (x: Scored) => number> = {
      priority: (x) => -(x.priority || -x.monthly / 1e6),
      value: (x) => -x.clv90,
      alive: (x) => x.pAlive,
      recent: (x) => x.lastSeen,
    };
    return [...r].sort((a, b) => key[sort](a) - key[sort](b));
  }, [scored, q, seg, sort]);
  useEffect(() => setPage(0), [q, seg, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: scored.length };
    for (const x of scored) c[x.segment] = (c[x.segment] ?? 0) + 1;
    return c;
  }, [scored]);

  return (
    <div className={s.page}>
      <div className={`card ${s.table}`} data-in>
        <div className={s.toolbar}>
          <div className={s.searchBox}><Search size={15} className="t3" /><input placeholder="Search customer name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className={s.filters}>
            {(["all", "champion", "loyal", "new", "at_risk", "lost"] as const).map((k) => (
              <button key={k} aria-pressed={seg === k} onClick={() => setSeg(k)}>
                {k !== "all" && <i style={{ background: SEGMENTS[k].color }} />}
                {k === "all" ? "All" : SEGMENTS[k].label}<small>{counts[k] ?? 0}</small>
              </button>
            ))}
          </div>
          <select className={`input ${s.sort}`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="priority">Sort: win-back priority</option>
            <option value="value">Sort: 90-day value</option>
            <option value="alive">Sort: least likely regular</option>
            <option value="recent">Sort: last seen</option>
          </select>
        </div>
        <div className={s.thead}><span>Customer</span><span>Segment</span><span>Usually</span><span>Last seen</span><span>Still a regular</span><span className={s.r}>Next 30 days</span><span className={s.r}>90-day value</span></div>
        {rows.slice(page * PER, page * PER + PER).map((x) => (
          <button key={x.c.id} className={`${s.tr} ${open?.c.id === x.c.id ? s.on : ""}`} onClick={() => setOpen(x)}>
            <span className={s.who}>
              <span className={s.av} style={{ background: `color-mix(in srgb, ${SEGMENTS[x.segment].color} 16%, white)`, color: SEGMENTS[x.segment].color }}>{x.c.name.split(" ").map((p) => p[0]).join("")}</span>
              <span><b>{x.c.name}</b><small className="mono">{maskVpa(x.c.vpa)}</small></span>
            </span>
            <span><span className="badge"><span className="sw" style={{ background: SEGMENTS[x.segment].color }} />{SEGMENTS[x.segment].label}</span></span>
            <span className="t2">{gapText(x.avgGap)}</span>
            <span className="mono t2">{Math.round(x.lastSeen)}d</span>
            <span className={s.alive}><i><b style={{ width: `${x.pAlive * 100}%`, background: x.pAlive > 0.7 ? "var(--c-sale)" : x.pAlive > 0.3 ? "var(--c-personal)" : "var(--c-refund)" }} /></i><span className="mono">{Math.round(x.pAlive * 100)}%</span></span>
            <span className={`mono ${s.r}`}>{x.next30.toFixed(1)}</span>
            <span className={`mono ${s.r}`}>{inr(x.clv90)}</span>
          </button>
        ))}
        <div className={s.foot}>
          <span className="t3">{rows.length} customers</span>
          <div className={s.pager}>
            <span className="t3">Page {page + 1} of {pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
            <button className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
      {open && <Drawer x={open} onClose={() => { setOpen(null); if (params.get("id")) router.replace("/app/customers"); }} />}
    </div>
  );
}

function Drawer({ x, onClose }: { x: Scored; onClose: () => void }) {
  const { bg } = usePehchaan();
  const { scored, statusOf } = useLive();
  const { sent, markSent, setConsent } = useApp();
  const consent = statusOf(x);
  const since = baseConsent(x.c);
  const panel = useRef<HTMLDivElement>(null);
  useGSAP(() => { gsap.fromTo(panel.current, { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: "expo.out" }); }, { dependencies: [x.c.id] });
  const curve = useMemo(() => aliveCurve(x, bg, 180), [x, bg]);
  const family = scored.filter((o) => o.c.household === x.c.household && o.c.id !== x.c.id);
  const visits = x.c.visits;
  const basket = visits.reduce((s2, v) => s2 + v.amount, 0) / visits.length;
  const story =
    x.segment === "at_risk" || x.segment === "lost"
      ? `Came ${gapText(x.avgGap)} for ${Math.round(x.rfm.tx / 30)} months. Last visit ${Math.round(x.lastSeen)} days ago — ${x.overdue.toFixed(1)}× longer than usual. The model's confidence they're still a regular fell from ${Math.round(x.pAlive30 * 100)}% to ${Math.round(x.pAlive * 100)}% this month.`
      : x.segment === "new"
        ? `New customer — first paid ${dMedium(new Date(visits[0].t).toISOString().slice(0, 10))}. ${visits.length} visits so far.`
        : `Steady regular: ${visits.length} visits, ${gapText(x.avgGap)}. Expected ${x.next30.toFixed(1)} more visits in the next 30 days.`;

  return (
    <div className={s.drawerBg} onClick={onClose}>
      <aside className={s.drawer} ref={panel} onClick={(e) => e.stopPropagation()}>
        <header className={s.dHead}>
          <span className="t3">Customer · {x.c.id}</span>
          <button className={s.close} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className={s.dTop}>
          <span className={s.avLg} style={{ background: `color-mix(in srgb, ${SEGMENTS[x.segment].color} 16%, white)`, color: SEGMENTS[x.segment].color }}>{x.c.name.split(" ").map((p) => p[0]).join("")}</span>
          <div>
            <h2>{x.c.name}</h2>
            <span className="mono t3">{maskVpa(x.c.vpa)}</span>
          </div>
          <span className="badge" style={{ marginLeft: "auto" }}><span className="sw" style={{ background: SEGMENTS[x.segment].color }} />{SEGMENTS[x.segment].label}</span>
        </div>
        <p className={s.story}>{story}</p>
        <div className={s.dSec}>
          <span className={s.dLabel}>Probability still a regular · last 6 months</span>
          <DecayChart points={curve} />
        </div>
        <div className={s.stats}>
          <Stat k="Visits" v={String(visits.length)} />
          <Stat k="Usually" v={gapText(x.avgGap)} />
          <Stat k="Avg basket" v={inr(basket)} />
          <Stat k="Monthly spend" v={inr(x.monthly)} />
          <Stat k="Next 30 days" v={`${x.next30.toFixed(1)} visits`} />
          <Stat k="90-day value" v={inr(x.clv90)} />
        </div>
        {family.length > 0 && (
          <div className={s.dSec}>
            <span className={s.dLabel}>Same household</span>
            {family.map((f) => <div key={f.c.id} className={s.fam}><b>{f.c.name}</b><span className="mono t3">{Math.round(f.pAlive * 100)}% regular</span></div>)}
          </div>
        )}
        <div className={s.dSec}>
          <span className={s.dLabel}>Consent</span>
          <div className={s.consentRow}>
            <span className={`badge ${consent === "opted_in" ? "badge-good" : consent === "withdrawn" ? "badge-warn" : ""}`}>{CONSENT_LABEL[consent]}</span>
            <span className="t3">{consent === "opted_in" ? `via ${since.channel} · since ${new Date(since.since).toISOString().slice(0, 10)}` : consent === "withdrawn" ? "No offers will be sent" : "Never messaged until they opt in"}</span>
          </div>
          {sent[x.c.id] ? (
            <span className="badge badge-good">Offer sent · ₹{sent[x.c.id].offer} off</span>
          ) : x.winnable && consent === "opted_in" ? (
            <button className="btn btn-primary" onClick={() => markSent([x.c.id], 30, { [x.c.id]: `sent manually by merchant · P(regular) ${Math.round(x.pAlive * 100)}%` })}><Send size={14} />Send ₹30 win-back offer</button>
          ) : null}
          <div className={s.consentActions}>
            {consent === "opted_in" && <button className="btn btn-ghost btn-sm" onClick={() => setConsent(x.c.id, "withdrawn")}>Record withdrawal</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Erase ${x.c.name}? Their profile and payment summary are deleted from Pehchaan.`)) { setConsent(x.c.id, "erased", x.c.name); onClose(); } }}>Erase customer data</button>
          </div>
          <Link href="/app/winback" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Open win-back agent</Link>
        </div>
      </aside>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className={s.stat}><span className="t3">{k}</span><b>{v}</b></div>;
}
