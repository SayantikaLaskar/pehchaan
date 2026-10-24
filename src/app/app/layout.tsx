"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Activity, ArrowLeftRight, Bell, ChevronsUpDown, FileWarning, LayoutDashboard, MessagesSquare, Search, Settings, ShieldCheck, TrendingUp, Upload,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { Logo } from "@/components/Logo";
import { MERCHANT } from "@/lib/data";
import { useLedger } from "@/lib/useLedger";
import s from "./shell.module.css";

const NAV = [
  { group: "Merchant", items: [
    { href: "/app", label: "Overview", icon: LayoutDashboard },
    { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
    { href: "/app/review", label: "Review queue", icon: MessagesSquare, badge: "review" },
    { href: "/app/notices", label: "Notice shield", icon: ShieldCheck, badge: "notice" },
    { href: "/app/forecast", label: "Forecast", icon: TrendingUp },
  ] },
  { group: "Paytm", items: [{ href: "/app/pulse", label: "Merchant pulse", icon: Activity }] },
];

const TITLES: Record<string, [string, string]> = {
  "/app": ["Overview", "Your money, sorted — and what the tax office should see."],
  "/app/transactions": ["Transactions", "Every UPI credit with the reason it was classified."],
  "/app/review": ["Review queue", "Kavach asks once, in Kannada, when it isn't sure."],
  "/app/notices": ["Notice shield", "Photograph a notice. Get the reconciliation and a reply."],
  "/app/forecast": ["Forecast", "When you'll cross the registration limit — and what to do first."],
  "/app/pulse": ["Merchant pulse", "Paytm view · merchants drifting to cash, and the agent bringing them back."],
  "/app/settings": ["Settings", "Language, voice and connections."],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { status, fy, setFy } = useApp();
  const { pending } = useLedger();
  const [cmd, setCmd] = useState(false);
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
  }, { dependencies: [path], scope: main });

  const live = status && (status.gemini || status.sarvam);

  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <Link href="/" className={s.brand}><Logo /><span>Hisaab Kavach</span></Link>
        <button className={s.workspace}>
          <span className={s.avatar}>SM</span>
          <span className={s.wsText}><b>{MERCHANT.shop.replace(" & Provisions", "")}</b><small>{MERCHANT.area.split(",")[0]} · Paytm QR</small></span>
          <ChevronsUpDown size={14} className="t3" />
        </button>
        <nav className={s.nav}>
          {NAV.map((g) => (
            <div key={g.group} className={s.group}>
              <span className={s.groupLabel}>{g.group}</span>
              {g.items.map((it) => {
                const active = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
                const Icon = it.icon;
                const count = it.badge === "review" ? pending.length : it.badge === "notice" ? 1 : 0;
                return (
                  <Link key={it.href} href={it.href} className={`${s.link} ${active ? s.active : ""}`}>
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{it.label}</span>
                    {count > 0 && <em className={it.badge === "notice" ? s.badgeWarn : ""}>{count}</em>}
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
            <span><b>{MERCHANT.name}</b><small>Owner · ಕನ್ನಡ</small></span>
          </div>
        </div>
      </aside>

      <div className={s.main} ref={main}>
        <header className={s.top}>
          <button className={s.search} onClick={() => setCmd(true)}>
            <Search size={15} /><span>Search transactions, pages…</span><span className="kbd">⌘K</span>
          </button>
          <div className={s.topRight}>
            <div className="seg" role="group" aria-label="Financial year">
              <button aria-pressed={fy === "curr"} onClick={() => setFy("curr")}>FY 26–27</button>
              <button aria-pressed={fy === "prev"} onClick={() => setFy("prev")}>FY 25–26</button>
            </div>
            <button className={s.iconBtn} aria-label="Notifications"><Bell size={16} /><i /></button>
            <Link href="/app/notices" className="btn btn-primary btn-sm"><Upload size={14} />Upload notice</Link>
          </div>
        </header>
        <div className={s.content}>
          {title && (
            <div className={s.pageHead} data-in>
              <div>
                <h1>{title}</h1>
                <p>{sub}</p>
              </div>
              {path === "/app" && pending.length > 0 && (
                <Link href="/app/review" className={s.alert}><FileWarning size={15} />{pending.length} credits need your answer</Link>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
      <nav className={s.mobileNav}>
        {NAV.flatMap((g) => g.items).map((it) => {
          const Icon = it.icon;
          const active = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
          return <Link key={it.href} href={it.href} className={active ? s.mOn : ""} aria-label={it.label}><Icon size={18} /></Link>;
        })}
      </nav>
      {cmd && <Command onClose={() => setCmd(false)} />}
    </div>
  );
}

function Command({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { txns } = useLedger();
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useGSAP(() => { gsap.from(box.current, { y: -10, scale: 0.98, autoAlpha: 0, duration: 0.35, ease: "expo.out" }); });
  const pages = Object.entries(TITLES).filter(([, [t]]) => t.toLowerCase().includes(q.toLowerCase()));
  const hits = q.length > 1 ? txns.filter((t) => !t.count && (t.payer + t.note + t.vpa).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const go = (href: string) => { router.push(href); onClose(); };
  return (
    <div className={s.cmdBg} onClick={onClose}>
      <div className={s.cmd} ref={box} onClick={(e) => e.stopPropagation()}>
        <div className={s.cmdIn}><Search size={16} className="t3" /><input autoFocus placeholder="Type a payer, page or amount…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="kbd">esc</span></div>
        <div className={s.cmdList}>
          {pages.length > 0 && <span className={s.cmdLabel}>Pages</span>}
          {pages.map(([href, [t]]) => <button key={href} onClick={() => go(href)}>{t}<small>{href}</small></button>)}
          {hits.length > 0 && <span className={s.cmdLabel}>Transactions</span>}
          {hits.map((t) => <button key={t.id} onClick={() => go(`/app/transactions?id=${t.id}`)}>{t.payer}<small className="mono">₹{t.amount.toLocaleString("en-IN")} · {t.date}</small></button>)}
        </div>
      </div>
    </div>
  );
}
