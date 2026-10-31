"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AudioLines, BellOff, Clock3, CloudOff, Cpu, HardDriveDownload, MapPinned, MessageCircle, PauseCircle, Phone, QrCode, Radar, RefreshCw, Store, TrendingDown, Truck, Wifi } from "lucide-react";
import { LOCKDOWN, OUTAGE, resilience, type AlarmSeries, type Classification, type ShockKind } from "@/lib/pehchaan/resilience";
import { WEEK0, WEEKS } from "@/lib/pehchaan/network";
import { DAY } from "@/lib/pehchaan/sim";
import { dMedium } from "@/lib/format";
import { flush, queued } from "@/lib/outbox";
import { useLive } from "@/lib/pehchaan/use";
import s from "./resilience.module.css";

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const TABS: { k: ShockKind; label: string; sub: string }[] = [
  { k: "local", label: "New dark store", sub: "local competitor" },
  { k: "citywide", label: "Lockdown", sub: "city-wide, COVID-style" },
  { k: "outage", label: "Soundbox offline", sub: "no network at one shop" },
];

const VERDICT: Record<ShockKind, { title: string; badge: string; tone: string }> = {
  local: { title: "Real churn — customers are switching to someone nearby", badge: "Local shock", tone: "badge-bad" },
  citywide: { title: "Not churn — the whole city stopped at once", badge: "City-wide event", tone: "badge-warn" },
  outage: { title: "Not churn — this shop's Soundbox went dark, the street didn't", badge: "Device / network outage", tone: "badge-info" },
};

const ACTIONS: Record<ShockKind, { icon: typeof Store; title: string; body: string }[]> = {
  local: [
    { icon: Radar, title: "Alert the merchants nearby", body: "Same week, same corner of HSR Layout — the radar shows where it's coming from." },
    { icon: MessageCircle, title: "Run win-back offers", body: "These regulars can still walk in; a ₹30 offer chosen by the agent brings them back." },
    { icon: TrendingDown, title: "Keep the churn clock running", body: "Silence here really means they left, so the model ages them in calendar time." },
  ],
  citywide: [
    { icon: PauseCircle, title: "Freeze the churn clock", body: "Business time: lockdown days count only for the trade that actually happened, so regulars aren't marked lost." },
    { icon: BellOff, title: "Pause discount offers", body: "Nobody can walk in — a ₹30 coupon would be wasted money and noise." },
    { icon: Truck, title: "Switch to WhatsApp ordering + delivery", body: "The agent tells regulars, in Kannada, that the shop delivers. Orders and UPI payments on delivery count as visits." },
  ],
  outage: [
    { icon: Clock3, title: "Hold this shop's scores", body: "Zero payments while neighbours trade normally means the device is down, not the customers." },
    { icon: HardDriveDownload, title: "Backfill when it reconnects", body: "Payments taken offline (UPI Lite X, cash-then-UPI, queued Soundbox events) are added with their real times." },
    { icon: Cpu, title: "Tell the merchant to check the Soundbox", body: "SIM, battery or signal — one nudge instead of 18 false churn alerts." },
  ],
};

export default function Resilience() {
  const [tab, setTab] = useState<ShockKind>("citywide");
  const r = useMemo(() => resilience(), []);
  const c: Classification = r[tab];
  const series: AlarmSeries | null = tab === "citywide" ? r.lockdownAlarms : tab === "outage" ? r.outageAlarms : null;
  const win = tab === "citywide" ? LOCKDOWN : tab === "outage" ? OUTAGE : null;

  return (
    <div className={s.page}>
      <section className={`card ${s.hero}`} data-in>
        <div>
          <span className="badge badge-info"><Radar />Shock-aware model</span>
          <h2>A lockdown is not churn. An outage is not churn. A dark store is.</h2>
          <p>Paytm sees every merchant at once, so Pehchaan can tell <b>why</b> payments stopped before it tells a shopkeeper that customers left. It classifies the shock from the network, then changes what the model and the agent do.</p>
        </div>
        <div className="seg" role="group" aria-label="Scenario">
          {TABS.map((t) => <button key={t.k} aria-pressed={tab === t.k} onClick={() => setTab(t.k)}>{t.label}</button>)}
        </div>
      </section>

      <section className={s.kpis}>
        <div className="card" data-in><span className={s.kL}>Shops dropping the same weeks</span><b className="mono">{c.flagged} / {c.total}</b><small>{Math.round(c.breadth * 100)}% of the network · {TABS.find((t) => t.k === tab)!.sub}</small></div>
        <div className="card" data-in><span className={s.kL}>Spatial pattern</span><b className="mono">R² {c.spatial.toFixed(2)}</b><small>{c.spatial > 0.6 ? "one source — steepest near a point" : "no single source"}</small></div>
        <div className="card" data-in><span className={s.kL}>City trade at the low point</span><b className="mono">{tab === "outage" ? "normal" : `${Math.round(c.activity * 100)}%`}</b><small>median merchant vs their own baseline</small></div>
        <div className="card" data-in><span className={s.kL}>False churn alarms avoided</span><b className={`mono ${s.good}`}>{series ? series.falseAlarmsAvoided : "—"}</b><small>{series ? `worst week ${series.peakNaive} → ${series.peakAware}` : "none to avoid — this churn is real"}</small></div>
      </section>

      <section className={s.two}>
        <div className="card" data-in>
          <div className="card-head">
            <div><div className="card-title">What Paytm&apos;s network sees</div><div className="card-sub">Median of 35 merchants around HSR Layout, weekly, vs their own 12-week baseline</div></div>
            <span className={`badge ${VERDICT[c.kind].tone}`}>{VERDICT[c.kind].badge}</span>
          </div>
          <div className="card-body">
            <IndexChart index={c.index} win={win} />
            <p className={s.verdict}>{VERDICT[c.kind].title}.</p>
            <p className={s.rule}>Rule: ≥ 50% of shops dropping together with no spatial source → <b>city-wide</b>. One shop to zero while peers trade → <b>outage</b>. Otherwise → <b>local</b>, and the radar locates it.</p>
          </div>
        </div>

        <div className="card" data-in>
          <div className="card-head"><div><div className="card-title">What Pehchaan does about it</div><div className="card-sub">The agent&apos;s playbook changes with the verdict</div></div></div>
          <ul className={s.actions}>
            {ACTIONS[c.kind].map((a) => { const I = a.icon; return <li key={a.title}><I size={16} /><span><b>{a.title}</b>{a.body}</span></li>; })}
          </ul>
          {c.kind === "citywide" && <div className={s.cta}><Link href="/app/orders" className="btn btn-primary btn-sm"><MessageCircle size={14} />Open WhatsApp orders</Link></div>}
          {c.kind === "local" && <div className={s.cta}><Link href="/app/radar" className="btn btn-primary btn-sm"><MapPinned size={14} />See it on the radar</Link></div>}
        </div>
      </section>

      {series && win && (
        <section className="card" data-in>
          <div className="card-head">
            <div>
              <div className="card-title">Customers flagged “slipping away”, week by week</div>
              <div className="card-sub">Same shop, same model · {tab === "citywide" ? "hypothetical six-week lockdown" : "hypothetical one-week Soundbox outage"}, {dMedium(iso(win[0]))} – {dMedium(iso(win[1]))} · reproduce: <span className="mono">npx tsx scripts/resilience-check.ts</span></div>
            </div>
            <div className={s.legend}><span><i style={{ background: "var(--text-3)" }} />No disruption</span><span><i style={{ background: "var(--bad)" }} />Calendar time</span><span><i style={{ background: "var(--good)" }} />Business time (Pehchaan)</span></div>
          </div>
          <div className="card-body"><AlarmChart a={series} win={win} /></div>
          <p className={s.note}>Read in calendar time, every regular who couldn&apos;t come in looks like they left — <b>{series.peakNaive} false alarms</b> in the worst week, and the agent would spend offers on all of them. In business time the model only ages customers by the trade that actually happened, so the extra flags fall to <b>{series.peakAware}</b>. The rise that remains is the real dark-store churn that was already under way.</p>
        </section>
      )}

      <Offline />
    </div>
  );
}

function IndexChart({ index, win }: { index: number[]; win: [number, number] | null }) {
  const W = 640, H = 200, p = 28;
  const max = 115, min = 0;
  const x = (i: number) => p + (i / (index.length - 1)) * (W - 2 * p);
  const y = (v: number) => H - p - ((v - min) / (max - min)) * (H - 2 * p);
  const wk = (t: number) => (t - WEEK0) / (7 * DAY);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label="City index">
      {win && <rect x={x(Math.max(0, wk(win[0])))} y={p - 6} width={Math.max(6, x(Math.min(WEEKS - 1, wk(win[1]))) - x(Math.max(0, wk(win[0]))))} height={H - 2 * p + 6} className={s.band} />}
      {[0, 50, 100].map((v) => <g key={v}><line x1={p} x2={W - p} y1={y(v)} y2={y(v)} className={s.grid} /><text x={4} y={y(v) + 4} className={s.tick}>{v}</text></g>)}
      <path d={index.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} className={s.line} />
    </svg>
  );
}

function AlarmChart({ a, win }: { a: AlarmSeries; win: [number, number] }) {
  const W = 1000, H = 240, p = 34;
  const all = a.weeks.flatMap((w) => [w.baseline, w.naive, w.aware]);
  const lo = Math.floor(Math.min(...all) * 0.9), hi = Math.ceil(Math.max(...all) * 1.05);
  const x = (i: number) => p + (i / Math.max(1, a.weeks.length - 1)) * (W - 2 * p);
  const y = (v: number) => H - p - ((v - lo) / (hi - lo)) * (H - 2 * p);
  const path = (k: "baseline" | "naive" | "aware") => a.weeks.map((w, i) => `${i ? "L" : "M"}${x(i)},${y(w[k])}`).join(" ");
  const i0 = a.weeks.findIndex((w) => w.t >= win[0]), i1 = a.weeks.findIndex((w) => w.t >= win[1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label="Churn alarms by week">
      {i0 >= 0 && <rect x={x(i0)} y={p - 8} width={x(i1 < 0 ? a.weeks.length - 1 : i1) - x(i0)} height={H - 2 * p + 8} className={s.band} />}
      {a.weeks.map((w, i) => <text key={w.t} x={x(i)} y={H - 10} textAnchor="middle" className={s.tick}>{w.label}</text>)}
      <path d={path("baseline")} className={s.base} />
      <path d={path("naive")} className={s.naive} />
      <path d={path("aware")} className={s.aware} />
      {a.weeks.map((w, i) => <circle key={w.t} cx={x(i)} cy={y(w.naive)} r={3.5} className={s.naiveDot} />)}
      {a.weeks.map((w, i) => <circle key={w.t + "a"} cx={x(i)} cy={y(w.aware)} r={3.5} className={s.awareDot} />)}
    </svg>
  );
}

function Offline() {
  const { scored } = useLive();
  const [online, setOnline] = useState(true);
  const [q, setQ] = useState(0);
  const [sw, setSw] = useState<"on" | "dev" | "off">("off");
  useEffect(() => {
    const up = () => { setOnline(navigator.onLine); setQ(queued()); };
    up();
    setSw(navigator.serviceWorker?.controller ? "on" : process.env.NODE_ENV !== "production" ? "dev" : "off");
    const qq = (e: Event) => setQ((e as CustomEvent<number>).detail);
    window.addEventListener("online", up); window.addEventListener("offline", up); window.addEventListener("pehchaan-outbox", qq);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); window.removeEventListener("pehchaan-outbox", qq); };
  }, []);
  return (
    <section className="card" data-in>
      <div className="card-head">
        <div><div className="card-title">No network? It keeps working</div><div className="card-sub">Offline-first by design — basements, monsoon outages, a Soundbox SIM with no signal</div></div>
        <span className={`badge ${online ? "badge-good" : "badge-warn"}`}>{online ? <Wifi /> : <CloudOff />}{online ? "This device is online" : "This device is offline"}</span>
      </div>
      <div className={s.offline}>
        <div><b className="mono">{scored.length}</b><span>customers scored on this device — the churn model runs in the browser, no server call</span></div>
        <div><b className="mono">{q}</b><span>actions waiting to sync {q > 0 && <button className="btn btn-ghost btn-sm" onClick={() => flush()}><RefreshCw size={12} />Sync now</button>}</span></div>
        <div><b>{sw === "on" ? "Cached" : sw === "dev" ? "Dev mode" : "On first load"}</b><span>{sw === "on" ? "app shell saved for offline use (service worker)" : sw === "dev" ? "service worker runs in the production build" : "the app caches itself after the first visit"}</span></div>
        <div><b>In the QR</b><span>every offer travels inside its QR, so the customer&apos;s phone opens it with no network; Redeem is queued and synced</span></div>
      </div>
      <div className={s.rural}>
        <div className={s.ruralHead}>
          <span className="badge badge-info"><AudioLines />Zero-bar mode · rural kiranas</span>
          <h3>No tower, no Wi-Fi, no problem: the counter becomes its own network.</h3>
          <p>Pehchaan never needs a live connection at the moment of truth. Each link below is ad hoc and local — the phone, the shop&apos;s device and the Soundbox talk directly, and everything syncs whenever any signal appears.</p>
        </div>
        <ol className={s.chain}>
          <li><Cpu size={16} /><span><b>Model at the edge</b>Scores are closed-form maths on a few numbers per customer — they run on the merchant&apos;s phone or Soundbox. Parameters refresh whenever a sync happens.</span></li>
          <li><QrCode size={16} /><span><b>Shop → customer: offer in the QR</b>The offer itself is encoded in the QR on the counter or the printed receipt. The customer&apos;s phone opens it with no data.</span></li>
          <li><AudioLines size={16} /><span><b>Customer → shop: redeem by sound</b>The phone plays a 2-second chirp; the shop&apos;s phone hears it and redeems (open-source ggwave, the same idea as NPCI&apos;s sound-based UPI 123PAY). No pairing, no internet.</span></li>
          <li><HardDriveDownload size={16} /><span><b>Store and forward</b>Redemptions, consent changes and Soundbox events queue on the device and sync over any 2G burst — with their real times, so the churn clock isn&apos;t fooled.</span></li>
          <li><Phone size={16} /><span><b>Offline UPI rails</b>Payments via UPI Lite X (tap phones, ₹500) and UPI 123PAY (IVR, missed call, sound — for feature phones) still reach Pehchaan when they settle, and count as visits.</span></li>
        </ol>
        <p className={s.try}>Try it now: open an offer on a phone, tap <b>No internet? Redeem by sound</b>, and press <b>Listen for offers</b> on the Win-back page or the Soundbox screen — the dashboard celebrates with both devices in airplane mode after the page has loaded.</p>
      </div>
    </section>
  );
}
