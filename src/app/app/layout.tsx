"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Bell, BrainCircuit, ChevronsUpDown, FileUp, HeartHandshake, IndianRupee, LayoutDashboard, Speaker, Radar, Search, Send, Settings, ShieldCheck, UserRoundX, Users } from "lucide-react";
import { useApp } from "@/components/Providers";
import { LiveLoop } from "@/components/LiveLoop";
import { LANGS } from "@/lib/pehchaan/i18n";
import { Logo } from "@/components/Logo";
import { SHOP } from "@/lib/pehchaan/sim";
import { maskVpa } from "@/lib/pehchaan/consent";
import { useLive, usePehchaan } from "@/lib/pehchaan/use";
import s from "./shell.module.css";

const NAV = [
  { group: "My shop", items: [
    { href: "/app", label: "Today", icon: LayoutDashboard },
    { href: "/app/customers", label: "Customers", icon: Users },
    { href: "/app/winback", label: "Win-back agent", icon: Send, badge: "winback" },
    { href: "/app/model", label: "How it predicts", icon: BrainCircuit },
    { href: "/app/import", label: "Your data", icon: FileUp },
    { href: "/app/trust", label: "Trust centre", icon: ShieldCheck },
  ] },
  { group: "Paytm network", items: [
    { href: "/app/radar", label: "Neighbourhood radar", icon: Radar, badge: "radar" },
    { href: "/app/business", label: "Business case", icon: IndianRupee },
  ] },
];

const TITLES: Record<string, [string, string]> = {
  "/app": ["Today", "Who's coming, who's slipping away, and what to do about it."],
  "/app/customers": ["Customers", "Every regular, recognised from their UPI payments — and how likely they are to come back."],
  "/app/winback": ["Win-back agent", "Picks who to bring back, writes to them in Kannada, and tracks who returns."],
  "/app/model": ["How it predicts", "The churn model behind every number — and how it scored on months it never saw."],
  "/app/radar": ["Neighbourhood radar", "Paytm view · regulars dropping off at many shops at once, and where it's coming from."],
  "/app/import": ["Your data", "Upload a Paytm payment export and see your own customers scored — in your browser."],
  "/app/business": ["Business case", "What Pehchaan is worth to Paytm — every assumption on the table."],
  "/app/trust": ["Trust centre", "Consent, data residency and an audit trail for every action — built for RBI, NPCI and DPDP rules."],
  "/app/settings": ["Settings", "Language, voice and connections."],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { status, sent, lang, setLang } = useApp();
  const { net } = usePehchaan();
  const { eligible } = useLive();
  const toWin = eligible.filter((w) => !sent[w.c.id]).length;
  const [cmd, setCmd] = useState(false);
  // Model numbers are floats computed in the browser; skipping SSR here avoids last-digit hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const main = useRef<HTMLDivElement>(null);
  const [title, sub] = TITLES[path] ?? ["", ""];

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); }
      if (e.key === "Escape") setCmd(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  useGSAP(() => {
    gsap.fromTo(main.current!.querySelectorAll("[data-in]"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "expo.out", stagger: 0.045 });
  }, { dependencies: [path, mounted], scope: main });

  const live = status && (status.gemini || status.sarvam);

  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <Link href="/" className={s.brand}><Logo /><span>Pehchaan</span></Link>
        <button className={s.workspace}>
          <span className={s.avatar}>SM</span>
          <span className={s.wsText}><b>{SHOP.short}</b><small>HSR Layout · Paytm Soundbox</small></span>
          <ChevronsUpDown size={14} className="t3" />
        </button>
        <nav className={s.nav}>
          {NAV.map((g) => (
            <div key={g.group} className={s.group}>
              <span className={s.groupLabel}>{g.group}</span>
              {g.items.map((it) => {
                const active = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
                const Icon = it.icon;
                const count = it.badge === "winback" ? toWin : it.badge === "radar" ? net.flaggedCount : 0;
                return (
                  <Link key={it.href} href={it.href} className={`${s.link} ${active ? s.active : ""}`}>
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{it.label}</span>
                    {count > 0 && <em className={it.badge === "radar" ? s.badgeWarn : ""}>{count}</em>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={s.sideFoot}>
          <Link href="/app/settings" className={`${s.link} ${path === "/app/settings" ? s.active : ""}`}><Settings size={16} strokeWidth={1.8} /><span>Settings</span></Link>
          <div className={s.conn}>
            <span className={s.dot} style={{ background: live ? "var(--good)" : "var(--text-3)" }} />
            <span>{status == null ? "Connecting…" : live ? [status.gemini && "Gemini", status.sarvam && "Sarvam"].filter(Boolean).join(" · ") + " connected" : "Offline demo mode"}</span>
          </div>
          <div className={s.user}>
            <span className={s.avatarSm}>MG</span>
            <span><b>{SHOP.owner}</b><small>Owner · ಕನ್ನಡ</small></span>
          </div>
        </div>
      </aside>

      <div className={s.main} ref={main}>
        <header className={s.top}>
          <button className={s.search} onClick={() => setCmd(true)}>
            <Search size={15} /><span>Search customers, pages…</span><span className="kbd">⌘K</span>
          </button>
          <div className={s.topRight}>
            <div className="seg" role="group" aria-label="Soundbox language">
              {LANGS.map((l) => <button key={l.k} aria-pressed={lang === l.k} onClick={() => setLang(l.k)}>{l.k === "en" ? "EN" : l.label}</button>)}
            </div>
            <button className={s.iconBtn} aria-label="Notifications"><Bell size={16} /><i /></button>
            <Link href="/kiosk" className="btn btn-secondary btn-sm"><Speaker size={14} />Soundbox</Link>
            <Link href="/app/winback" className="btn btn-primary btn-sm"><HeartHandshake size={14} />Win back {toWin || ""}</Link>
          </div>
        </header>
        <div className={s.content}>
          {title && (
            <div className={s.pageHead} data-in>
              <div>
                <h1>{title}</h1>
                <p>{sub}</p>
              </div>
              {path === "/app" && net.merchants[0].flagged && (
                <Link href="/app/radar" className={s.alert}><UserRoundX size={15} />Regulars are leaving across HSR Layout — see radar</Link>
              )}
            </div>
          )}
          {mounted ? children : <div className="skeleton" style={{ height: 420 }} />}
        </div>
      </div>
      <nav className={s.mobileNav}>
        {NAV.flatMap((g) => g.items).map((it) => {
          const Icon = it.icon;
          const active = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
          return <Link key={it.href} href={it.href} className={active ? s.mOn : ""} aria-label={it.label}><Icon size={18} /></Link>;
        })}
      </nav>
      <LiveLoop />
      {cmd && <Command onClose={() => setCmd(false)} />}
    </div>
  );
}

function Command({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { scored } = useLive();
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useGSAP(() => { gsap.from(box.current, { y: -10, scale: 0.98, autoAlpha: 0, duration: 0.35, ease: "expo.out" }); });
  const pages = Object.entries(TITLES).filter(([, [t]]) => t.toLowerCase().includes(q.toLowerCase()));
  const hits = q.length > 1 ? scored.filter((x) => x.c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const go = (href: string) => { router.push(href); onClose(); };
  return (
    <div className={s.cmdBg} onClick={onClose}>
      <div className={s.cmd} ref={box} onClick={(e) => e.stopPropagation()}>
        <div className={s.cmdIn}><Search size={16} className="t3" /><input autoFocus placeholder="Type a customer name or page…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="kbd">esc</span></div>
        <div className={s.cmdList}>
          {pages.length > 0 && <span className={s.cmdLabel}>Pages</span>}
          {pages.map(([href, [t]]) => <button key={href} onClick={() => go(href)}>{t}<small>{href}</small></button>)}
          {hits.length > 0 && <span className={s.cmdLabel}>Customers</span>}
          {hits.map((x) => <button key={x.c.id} onClick={() => go(`/app/customers?id=${x.c.id}`)}>{x.c.name}<small className="mono">{Math.round(x.pAlive * 100)}% likely regular · {maskVpa(x.c.vpa)}</small></button>)}
        </div>
      </div>
    </div>
  );
}
