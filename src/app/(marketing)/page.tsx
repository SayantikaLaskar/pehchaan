"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, BadgeIndianRupee, Check, ChevronDown, FileSearch, FileText, Languages, LineChart, Mic, QrCode, Radar, ShieldCheck, Sparkles, Volume2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Composition, CumulativeChart } from "@/components/charts";
import { FY_PREV, getData } from "@/lib/data";
import { CLS_META, THRESHOLD, forecast, inr, summarize } from "@/lib/gst";
import s from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger);
const L = (n: number) => inr(n, { compact: true });

const TICKER = [
  ["QR collections · 72 payments", 14950, "sale"], ["RAVI GOWDA · inward remit", 40000, "personal"], ["MUTHOOT FINANCE · gold loan", 300000, "loan"],
  ["PAYTM REFUND · reversal", 1419, "refund"], ["MANJUNATH GOWDA · self", 70000, "own"], ["GREEN BOWL CAFE · weekly veg", 36000, "sale"],
  ["SRI VINAYAKA CHITS · prize", 125000, "own"], ["KAVYA GOWDA · for house", 35000, "personal"], ["BAJAJ FINANCE · PL disbursal", 200000, "loan"],
  ["QR collections · 58 payments", 12198, "sale"],
] as const;

const STORY = [
  { k: "Listen", icon: QrCode, title: "Every credit, the moment it lands.", body: "Kavach reads the Paytm QR stream and the bank account together — not just counter sales, but every remittance, loan and refund." },
  { k: "Sort", icon: Sparkles, title: "Sales vs everything that isn't.", body: "Lender disbursals, family transfers, self-transfers, chit payouts and reversals are separated — each with a reason an officer will accept." },
  { k: "Ask", icon: Volume2, title: "Unsure? It asks — in Kannada.", body: "Low-confidence credits become one spoken question on the Soundbox. One word or one tap to answer. Nothing is guessed." },
  { k: "Shield", icon: ShieldCheck, title: "A notice becomes a one-page reply.", body: "Photograph the notice. Kavach reconciles it against the sorted ledger and drafts the reply your CA can sign in minutes." },
];

const FAQ = [
  ["Is this a way to avoid tax?", "No. Kavach makes merchants correctly compliant. It separates income from non-income, warns before a registration threshold is crossed, and estimates the tax due. Every reply is a draft for a CA to review."],
  ["Why would a merchant stop accepting UPI?", "Because state tax offices issued notices using total UPI credits as turnover. A brother's remittance and a gold loan looked like sales. Many traders put up “No UPI, only cash” boards. Kavach removes that fear."],
  ["Which languages does it speak?", "Kannada first, with Hindi and English. Voice runs on Sarvam AI's Indic speech models, so it works on the Soundbox a merchant already has."],
  ["What happens when a merchant does cross ₹40 lakh?", "Kavach flags it months ahead, recommends the composition scheme (1% on taxable sales for traders), and keeps the evidence ready for registration."],
  ["Where does the data come from?", "Paytm QR settlements and the merchant's linked bank statement. Sales mix is inferred from supplier payments — APMC traders vs FMCG distributors."],
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [faq, setFaq] = useState<number | null>(0);

  const { sum, cum } = useMemo(() => {
    const { txns, purchases } = getData();
    const sum = summarize(txns, purchases, FY_PREV, {});
    const fc = forecast(txns, {});
    const cum = fc.series.map((m) => ({ label: m.label, actual: m.isFuture ? null : m.cumulative, projected: m.isFuture || m.isNow ? m.cumulative : null }));
    return { sum, cum };
  }, []);

  useGSAP(() => {
    // Hero
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(`.${s.pill}`, { y: 12, autoAlpha: 0, duration: 0.8 })
      .from(`.${s.h1} .${s.word}`, { yPercent: 110, duration: 1.2, stagger: 0.06 }, 0.1)
      .from(`.${s.lede}, .${s.ctas}, .${s.trust}`, { y: 16, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.5)
      .from(`.${s.frame}`, { y: 80, autoAlpha: 0, duration: 1.6 }, 0.6)
      .from(`.${s.float}`, { scale: 0.8, autoAlpha: 0, duration: 1, stagger: 0.12 }, 1.2);

    gsap.fromTo(`.${s.frame}`, { rotateX: 22, scale: 0.92 }, { rotateX: 0, scale: 1, ease: "none", scrollTrigger: { trigger: `.${s.stageHero}`, start: "top 85%", end: "top 15%", scrub: true } });
    gsap.utils.toArray<HTMLElement>(`.${s.float}`).forEach((el, i) => {
      gsap.to(el, { y: i % 2 ? -14 : 14, duration: 2.6 + i * 0.4, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(el, { yPercent: -60 - i * 25, ease: "none", scrollTrigger: { trigger: `.${s.stageHero}`, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Problem
    gsap.from(`.${s.sign}`, { rotate: -14, y: 80, autoAlpha: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: `.${s.problem}`, start: "top 70%" } });
    const big = { v: 0 };
    ScrollTrigger.create({
      trigger: `.${s.problem}`, start: "top 65%", once: true,
      onEnter: () => gsap.to(big, { v: 65.45, duration: 2, ease: "expo.out", onUpdate: () => { const el = root.current?.querySelector(`.${s.bigNum} [data-num]`); if (el) el.textContent = `₹${big.v.toFixed(2)}`; } }),
    });
    gsap.from(`.${s.pRow}`, { y: 30, autoAlpha: 0, duration: 1, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: `.${s.pRows}`, start: "top 80%" } });

    // Pinned story
    const mm = gsap.matchMedia();
    mm.add("(min-width: 961px)", () => {
      ScrollTrigger.create({
        trigger: `.${s.story}`, start: "top top", end: `+=${STORY.length * 70}%`, pin: true, scrub: true,
        onUpdate: (self) => setStep(Math.min(STORY.length - 1, Math.floor(self.progress * STORY.length))),
      });
      gsap.fromTo(`.${s.progressFill}`, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: `.${s.story}`, start: "top top", end: `+=${STORY.length * 70}%`, scrub: true } });
    });

    // Generic reveals
    gsap.utils.toArray<HTMLElement>(`.${s.reveal}`).forEach((el) =>
      gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } }),
    );
    gsap.from(`.${s.tile}`, { y: 50, autoAlpha: 0, duration: 1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: `.${s.bento}`, start: "top 80%" } });
    gsap.from(`.${s.plan}`, { y: 40, autoAlpha: 0, duration: 1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: `.${s.plans}`, start: "top 80%" } });

    // Nav background
    ScrollTrigger.create({ start: 40, onUpdate: (self) => root.current?.querySelector(`.${s.nav}`)?.classList.toggle(s.navOn, self.scroll() > 40) });
  }, { scope: root });

  useGSAP(() => {
    gsap.fromTo(`.${s.visual}[data-step="${step}"] .${s.vIn}`, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: "expo.out" });
  }, { scope: root, dependencies: [step] });

  const parts = (["sale", "personal", "loan", "own", "refund"] as const).map((k) => ({ key: k, label: CLS_META[k].label, value: sum.by[k] + (k === "sale" ? sum.by.review : 0), color: CLS_META[k].tone }));

  return (
    <div ref={root} className={s.root}>
      {/* NAV */}
      <header className={s.nav}>
        <div className={s.navIn}>
          <Link href="/" className={s.brand}><Logo /><span>Hisaab Kavach</span></Link>
          <nav className={s.links}>
            <a href="#how">How it works</a>
            <a href="#features">Product</a>
            <a href="#paytm">For Paytm</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={s.navCta}>
            <Link href="/app" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link href="/app" className="btn btn-primary btn-sm">Open dashboard <ArrowRight size={14} /></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={s.hero}>
        <div className={s.heroBg} aria-hidden />
        <div className={s.heroIn}>
          <Link href="/app/notices" className={s.pill}><span className="badge badge-info">New</span>Notice Shield now reads Kannada notices <ArrowRight size={13} /></Link>
          <h1 className={s.h1}>
            <span className={s.line}><span className={s.word}>UPI</span> <span className={s.word}>is</span> <span className={s.word}>not</span></span>
            <span className={s.line}><span className={`${s.word} serif`}>income.</span></span>
          </h1>
          <p className={s.lede}>
            The AI accountant inside every Paytm Soundbox. Hisaab Kavach separates real sales from family money, loans and refunds —
            and turns a tax notice into a reply in minutes, in Kannada.
          </p>
          <div className={s.ctas}>
            <Link href="/app" className="btn btn-primary btn-lg">Open live demo <ArrowRight size={16} /></Link>
            <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
          </div>
          <div className={s.trust}>
            <span><Check size={14} />Works on Paytm QR &amp; Soundbox</span>
            <span><Check size={14} />ಕನ್ನಡ · हिंदी · English</span>
            <span><Check size={14} />Every reply CA-reviewable</span>
          </div>
        </div>

        <div className={s.stageHero}>
          <div className={s.frame}>
            <div className={s.chrome}><i /><i /><i /><span>app.hisaabkavach.in/overview</span></div>
            <div className={s.mock}>
              <aside className={s.mSide}>
                <div className={s.mBrand}><Logo size={18} /><b>Kavach</b></div>
                {["Overview", "Transactions", "Review queue", "Notice shield", "Forecast"].map((x, i) => <span key={x} className={i === 0 ? s.mOn : ""}>{x}</span>)}
              </aside>
              <div className={s.mMain}>
                <div className={s.mKpis}>
                  <div><small>UPI credits · FY 25–26</small><b className="mono">{L(sum.gross)}</b></div>
                  <div><small>Business turnover</small><b className="mono">{L(sum.business)}</b></div>
                  <div><small>Set aside</small><b className="mono">{L(sum.nonBusiness)}</b></div>
                  <div className={s.mGood}><small>Tax due on notice</small><b className="mono">₹0</b></div>
                </div>
                <div className={s.mGrid}>
                  <div className={s.mCard}><small>Cumulative turnover vs ₹40L · FY 26–27</small><CumulativeChart points={cum} threshold={THRESHOLD} fmt={L} height={200} /></div>
                  <div className={s.mCard}><small>Where the money came from</small><Composition parts={parts} fmt={L} /></div>
                </div>
              </div>
            </div>
          </div>
          <div className={`${s.float} ${s.f1}`}><span className={s.fDot} style={{ background: "var(--c-loan)" }} /><span><b>MUTHOOT FINANCE</b><small>Gold loan · not income</small></span><em className="mono">₹3,00,000</em></div>
          <div className={`${s.float} ${s.f2}`}><span className={s.fDot} style={{ background: "var(--c-personal)" }} /><span><b>RAVI GOWDA</b><small>Brother in Dubai · personal</small></span><em className="mono">₹40,000</em></div>
          <div className={`${s.float} ${s.f3}`}><ShieldCheck size={16} /><span><b>Notice ASMT-10</b><small><s>₹7,71,150</s> → ₹0 due</small></span></div>
          <div className={`${s.float} ${s.f4}`}><Volume2 size={16} /><span className="kn">ಇದು ಅಂಗಡಿ ವ್ಯಾಪಾರವೇ?</span></div>
        </div>
      </section>

      {/* TICKER */}
      <section className={s.ticker} aria-label="Live classification">
        <div className={s.track}>
          {[...TICKER, ...TICKER].map(([p, a, c], i) => (
            <span key={i} className={s.tItem}>
              <span className={s.tName}>{p}</span>
              <span className="mono">{inr(a)}</span>
              <span className="badge"><span className="sw" style={{ background: CLS_META[c].tone }} />{CLS_META[c].short}</span>
            </span>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className={s.problem}>
        <div className={s.problemIn}>
          <div className={s.pLeft}>
            <span className={s.eyebrow}>The problem</span>
            <h2 className={s.h2Dark}>A notice based on UPI inflows asked a Bengaluru juice seller for</h2>
            <div className={s.bigNum}><span data-num>₹0.00</span><small> lakh</small></div>
            <p className={s.pText}>In July 2025, Karnataka&apos;s tax department used UPI data to issue notices to small traders. The response on the street was immediate.</p>
            <div className={s.sign}><span>NO UPI</span><span>ONLY CASH</span></div>
          </div>
          <div className={s.pRows}>
            {[
              ["Credits ≠ turnover", "A brother's remittance, a gold loan and a supplier refund all landed on the same QR — and all were counted as sales."],
              ["Exempt goods, taxed anyway", "Vegetables, fruit and milk are nil-rated under GST. The notices didn't distinguish."],
              ["QR codes came down", "Traders peeled off stickers and went back to cash. Every one is volume Paytm loses and a merchant pushed out of the formal economy."],
            ].map(([t, d], i) => (
              <div key={t} className={s.pRow}>
                <span className="mono">0{i + 1}</span>
                <div><b>{t}</b><p>{d}</p></div>
              </div>
            ))}
            <p className={s.src}>Sources: ETV Bharat, The South First, Business Today (Jul 2025)</p>
          </div>
        </div>
      </section>

      {/* STORY (pinned) */}
      <section id="how" className={s.story}>
        <div className={s.storyIn}>
          <div className={s.storyLeft}>
            <span className={s.eyebrowDark}>How it works</span>
            <h2 className={s.h2}>Four steps. <span className="serif">Zero paperwork.</span></h2>
            <div className={s.steps}>
              <div className={s.progress}><span className={s.progressFill} /></div>
              {STORY.map((st, i) => {
                const Icon = st.icon;
                return (
                  <button key={st.k} className={`${s.step} ${i === step ? s.stepOn : ""}`} onClick={() => setStep(i)}>
                    <span className={s.stepIcon}><Icon size={16} /></span>
                    <span><b>{st.k} — {st.title}</b><small>{st.body}</small></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={s.storyRight}>
            <div className={s.visual} data-step={step}>
              {step === 0 && (
                <div className={s.vList}>
                  {TICKER.slice(0, 6).map(([p, a], i) => (
                    <div key={i} className={`${s.vRow} ${s.vIn}`}><span className={s.vAv}>{p[0]}</span><span>{p}</span><em className="mono">+{inr(a)}</em></div>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className={s.vList}>
                  {TICKER.slice(0, 6).map(([p, a, c], i) => (
                    <div key={i} className={`${s.vRow} ${s.vIn}`}><span className={s.vAv} style={{ background: `color-mix(in srgb, ${CLS_META[c].tone} 16%, white)`, color: CLS_META[c].tone }}>{p[0]}</span><span>{p}</span><span className="badge"><span className="sw" style={{ background: CLS_META[c].tone }} />{CLS_META[c].short}</span><em className="mono">{inr(a)}</em></div>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div className={s.vAsk}>
                  <div className={`${s.vBubble} ${s.vIn}`}><span className={s.vBot}><Mic size={14} /></span><p className="kn">ಗ್ರೀನ್ ಬೌಲ್ ಕೆಫೆ ಅವರಿಂದ ₹36,000 ಬಂದಿದೆ. ಇದು ಅಂಗಡಿ ವ್ಯಾಪಾರವೇ, ಅಥವಾ ಮನೆಯ ಹಣವೇ?</p></div>
                  <div className={`${s.vWave} ${s.vIn}`}>{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ height: `${20 + Math.abs(Math.sin(i * 1.7)) * 70}%` }} />)}</div>
                  <div className={`${s.vReply} ${s.vIn}`}><p className="kn">“ವ್ಯಾಪಾರ — ಕೆಫೆ ಆರ್ಡರ್.”</p><span className="badge badge-good"><Check size={12} />Logged as sale</span></div>
                </div>
              )}
              {step === 3 && (
                <div className={s.vShield}>
                  <div className={`${s.vNotice} ${s.vIn}`}><FileText size={18} /><span><b>ASMT-10 · FY 2025–26</b><small>Turnover per UPI data: ₹53,00,000</small></span></div>
                  <div className={`${s.vRec} ${s.vIn}`}>
                    {[["UPI credits", sum.gross, false], ["Family & friends", -sum.by.personal, true], ["Loans", -sum.by.loan, true], ["Own money", -sum.by.own, true], ["Business turnover", sum.business, false]].map(([k, v, minus]) => (
                      <div key={k as string} className={minus ? s.minus : ""}><span>{k as string}</span><span className="mono">{(v as number) < 0 ? "−" : ""}{L(Math.abs(v as number))}</span></div>
                    ))}
                  </div>
                  <div className={`${s.vDue} ${s.vIn}`}><span><small>Demanded</small><s className="mono">₹7,71,150</s></span><ArrowRight size={18} /><span><small>Actually due</small><b className="mono">₹0</b></span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* BENTO */}
      <section id="features" className={s.section}>
        <div className={s.head}>
          <span className={s.eyebrowDark}>Product</span>
          <h2 className={`${s.h2} ${s.reveal}`}>Everything a small merchant&apos;s <span className="serif">accountant</span> would do.</h2>
        </div>
        <div className={s.bento}>
          <div className={`${s.tile} ${s.tWide}`}>
            <div className={s.tHead}><LineChart size={18} /><b>Turnover meter &amp; forecast</b></div>
            <p>Know months ahead if you&apos;ll cross ₹40 lakh — and what registering will actually cost.</p>
            <div className={s.tMeter}>
              <div><span style={{ width: "62%" }} /><em className="mono">₹24.3L today</em></div>
              <div className={s.tProj}><span style={{ width: "74%" }} /><em className="mono">₹44.3L by March</em></div>
              <i style={{ left: "66.6%" }}><small>₹40L</small></i>
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.tHead}><Languages size={18} /><b>Asks in Kannada</b></div>
            <p>Unclear credits become one spoken question on the Soundbox.</p>
            <div className={s.tWave}>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.06}s` }} />)}</div>
          </div>
          <div className={s.tile}>
            <div className={s.tHead}><FileSearch size={18} /><b>Notice shield</b></div>
            <p>Photo in, reconciliation and reply letter out.</p>
            <div className={s.tStrike}><s className="mono">₹7,71,150</s><b className="mono">₹0</b></div>
          </div>
          <div className={s.tile}>
            <div className={s.tHead}><BadgeIndianRupee size={18} /><b>Exempt sales, proven</b></div>
            <p>Sales mix inferred from {sum.mix.n} supplier payments — APMC vs FMCG.</p>
            <div className={s.tSplit}><span style={{ flexGrow: Math.round(sum.mix.exemptShare * 100) }}>{Math.round(sum.mix.exemptShare * 100)}% exempt</span><span style={{ flexGrow: 100 - Math.round(sum.mix.exemptShare * 100) }}>{100 - Math.round(sum.mix.exemptShare * 100)}%</span></div>
          </div>
          <div className={`${s.tile} ${s.tWide}`} id="paytm">
            <div className={s.tHead}><Radar size={18} /><b>Merchant pulse — for Paytm</b></div>
            <p>An autonomous agent spots merchants drifting to cash, explains their numbers in their language, and brings the QR back on.</p>
            <ul className={s.tRisk}>
              {[["Lakshmi Darshini", "QR scans 0 for 6 days", "Called in Kannada", "warn"], ["Sri Ganesh Fruits", "Collections −46%", "QR back on", "good"], ["Mahalakshmi Provisions", "Asked about a tax notice", "Report sent", "info"]].map(([n, sig, st, t]) => (
                <li key={n}><b>{n}</b><span>{sig}</span><span className={`badge badge-${t}`}>{st}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section className={s.impact}>
        <div className={s.impactIn}>
          {[
            ["₹0", "tax wrongly demanded once credits are sorted", "Merchant"],
            ["< 60s", "from a notice photo to a draft reply", "Merchant"],
            [L(sum.nonBusiness), `of ${L(sum.gross)} in credits proven non-business`, "Officer"],
            ["71%", "of drifting merchants back on QR in simulation", "Paytm"],
          ].map(([n, d, who]) => (
            <div key={d} className={`${s.iItem} ${s.reveal}`}>
              <span className={s.iWho}>{who}</span>
              <b>{n}</b>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className={s.section}>
        <div className={s.head}>
          <span className={s.eyebrowDark}>Business model</span>
          <h2 className={`${s.h2} ${s.reveal}`}>Free for every merchant. <span className="serif">Paid when it saves real money.</span></h2>
        </div>
        <div className={s.plans}>
          {[
            { name: "Kavach", price: "Free", per: "with every Soundbox", feats: ["Auto-sorted ledger", "₹40L forecast & alerts", "Kannada voice questions", "Monthly turnover report"], cta: "Included", hl: false },
            { name: "Kavach Pro", price: "₹99", per: "per month", feats: ["Notice reader & reply drafts", "CA review partner network", "Evidence pack for officers", "Composition filing reminders"], cta: "Start 30-day trial", hl: true },
            { name: "Paytm Pulse", price: "Internal", per: "retention engine", feats: ["Cash-drift detection", "Autonomous win-back agent", "Field-team task routing", "Protects QR & Soundbox revenue"], cta: "For Paytm teams", hl: false },
          ].map((p) => (
            <div key={p.name} className={`${s.plan} ${p.hl ? s.planHl : ""}`}>
              {p.hl && <span className={s.popular}>Most merchants upgrade after their first notice</span>}
              <b className={s.planName}>{p.name}</b>
              <div className={s.price}><span>{p.price}</span><small>{p.per}</small></div>
              <ul>{p.feats.map((f) => <li key={f}><Check size={14} />{f}</li>)}</ul>
              <Link href="/app" className={`btn ${p.hl ? "btn-primary" : "btn-secondary"}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={s.section}>
        <div className={s.faqGrid}>
          <div className={s.head}>
            <span className={s.eyebrowDark}>FAQ</span>
            <h2 className={`${s.h2} ${s.reveal}`}>Questions judges <span className="serif">(and officers)</span> ask.</h2>
          </div>
          <div className={s.faq}>
            {FAQ.map(([q, a], i) => (
              <div key={q} className={`${s.qa} ${faq === i ? s.qaOn : ""}`}>
                <button onClick={() => setFaq(faq === i ? null : i)}><span>{q}</span><ChevronDown size={18} /></button>
                <div className={s.ans}><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={s.cta}>
        <div className={s.ctaGlow} aria-hidden />
        <h2 className={s.reveal}>Keep the QR <span className="serif">on.</span></h2>
        <p className={s.reveal}>Open the live dashboard for Sri Manjunatha Vegetables, HSR Layout.</p>
        <div className={`${s.ctas} ${s.reveal}`}>
          <Link href="/app" className="btn btn-lg" style={{ background: "#fff", color: "var(--navy)" }}>Open dashboard <ArrowRight size={16} /></Link>
          <Link href="/app/notices" className={`btn btn-lg ${s.ghostDark}`}>Try the notice shield</Link>
        </div>
      </section>

      <footer className={s.foot}>
        <div className={s.footIn}>
          <div className={s.brand}><Logo /><span>Hisaab Kavach</span></div>
          <span>Built for Paytm Build for India AI Hackathon · Bengaluru 2026</span>
          <span>Sayantika Laskar &amp; Harsh Shukla · Powered by Gemini &amp; Sarvam AI</span>
        </div>
      </footer>
    </div>
  );
}
