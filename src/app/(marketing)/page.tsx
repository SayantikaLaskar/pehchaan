"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, BellRing, BrainCircuit, Check, ChevronDown, Fingerprint, LineChart, Radar, Send, Volume2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Composition, CumulativeChart } from "@/components/charts";
import { SEGMENTS, type Segment } from "@/lib/pehchaan/model";
import { L, gapText, usePehchaan } from "@/lib/pehchaan/use";
import { HeroFx, RotatingWord } from "./HeroFx";
import { Recognition } from "./Recognition";
import s from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger);

const STORY = [
  { k: "Recognise", icon: Fingerprint, title: "Every UPI payment becomes a customer.", body: "The payer name and UPI ID on each Soundbox payment build a profile automatically: how often they come, what they spend, who shares a household." },
  { k: "Predict", icon: BrainCircuit, title: "Know who's quietly leaving.", body: "A probabilistic churn model (MBG/NBD) estimates, for every customer, the chance they're still a regular — and flags the moment that chance falls." },
  { k: "Act", icon: Send, title: "An agent that wins them back.", body: "Each week it picks who's worth an offer, writes to them in Kannada through the Paytm app, and recognises them on the Soundbox when they return." },
  { k: "See the city", icon: Radar, title: "Paytm sees what no shop can.", body: "When regulars leave many shops in the same week, Paytm triangulates the cause — like a new quick-commerce dark store — and warns every merchant nearby." },
];

const FAQ = [
  ["Is this just an LLM wrapper?", "No. Every number comes from statistical models fitted to payment history — MBG/NBD for churn and Gamma-Gamma for spend — chosen by testing four approaches out of sample, on our shop and on real CDNOW purchase data. The LLM only writes the Kannada message; it never decides who or how much."],
  ["Where does the customer data come from?", "From payments the merchant already receives: the payer name and UPI ID that appear on every Paytm for Business statement. No new app, no data entry, no loyalty card."],
  ["What about privacy?", "Merchants never see phone numbers. Offers are delivered as Paytm app notifications under Paytm's consent settings, and customers can opt out. Network insights are aggregated across shops."],
  ["Does it follow RBI and NPCI rules?", "It is designed to: payment data is processed only in India (RBI payment-data storage rules), payer data is never shared outside Paytm (NPCI UPI norms), customers opt in and can withdraw or be erased (DPDP Act 2023), messages go only to opted-in customers with a monthly cap (TRAI), and scores are never used for credit. Every agent action is in an exportable audit log."],
  ["What about customers who pay cash?", "Pehchaan only sees UPI regulars — today the majority of a city kirana's repeat customers, and growing every month. Cash customers simply aren't scored."],
  ["Why is Paytm the one to build this?", "Three things in one place: the Soundbox at the counter to recognise people, the consumer app to deliver offers, and payment data across ~1.5 crore subscription merchants to see neighbourhood-level shifts."],
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [faq, setFaq] = useState<number | null>(0);
  const { scored, winnable, shock, backtest, net } = usePehchaan();

  const stats = useMemo(() => {
    const active = scored.filter((x) => x.segment === "champion" || x.segment === "loyal").length;
    const atRisk = winnable.reduce((a, x) => a + x.monthly, 0);
    const parts = (Object.keys(SEGMENTS) as Segment[]).map((k) => ({ key: k, label: SEGMENTS[k].label, value: scored.filter((x) => x.segment === k).length, color: SEGMENTS[k].color }));
    const weekly = shock.weekly.slice(-16).map((w) => ({ label: w.label, actual: w.actual, projected: w.expected }));
    return { active, atRisk, parts, weekly };
  }, [scored, winnable, shock]);
  const top = winnable[0];

  useGSAP(() => {
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

    gsap.from(`.${s.sign}`, { rotate: -14, y: 80, autoAlpha: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: `.${s.problem}`, start: "top 70%" } });
    const big = { v: 0 };
    ScrollTrigger.create({
      trigger: `.${s.problem}`, start: "top 65%", once: true,
      onEnter: () => gsap.to(big, { v: 51, duration: 2, ease: "expo.out", onUpdate: () => { const el = root.current?.querySelector(`.${s.bigNum} [data-num]`); if (el) el.textContent = `${Math.round(big.v)}%`; } }),
    });
    gsap.from(`.${s.pRow}`, { y: 30, autoAlpha: 0, duration: 1, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: `.${s.pRows}`, start: "top 80%" } });

    const mm = gsap.matchMedia();
    mm.add("(min-width: 961px)", () => {
      ScrollTrigger.create({
        trigger: `.${s.story}`, start: "top top", end: `+=${STORY.length * 70}%`, pin: true, scrub: true,
        onUpdate: (self) => setStep(Math.min(STORY.length - 1, Math.floor(self.progress * STORY.length))),
      });
      gsap.fromTo(`.${s.progressFill}`, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: `.${s.story}`, start: "top top", end: `+=${STORY.length * 70}%`, scrub: true } });
    });

    gsap.utils.toArray<HTMLElement>(`.${s.reveal}`).forEach((el) =>
      gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } }),
    );
    gsap.from(`.${s.tile}`, { y: 50, autoAlpha: 0, duration: 1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: `.${s.bento}`, start: "top 80%" } });
    gsap.from(`.${s.plan}`, { y: 40, autoAlpha: 0, duration: 1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: `.${s.plans}`, start: "top 80%" } });
    ScrollTrigger.create({ start: 40, onUpdate: (self) => root.current?.querySelector(`.${s.nav}`)?.classList.toggle(s.navOn, self.scroll() > 40) });
  }, { scope: root });

  useGSAP(() => {
    gsap.fromTo(`.${s.visual}[data-step="${step}"] .${s.vIn}`, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: "expo.out" });
  }, { scope: root, dependencies: [step] });

  const ticker = scored.filter((x) => x.c.visits.length > 8).slice(0, 12);

  return (
    <div ref={root} className={s.root}>
      <header className={s.nav}>
        <div className={s.navIn}>
          <Link href="/" className={s.brand}><Logo animate /><span>Pehchaan</span><small className={s.brandSub}>for Paytm merchants</small></Link>
          <nav className={s.links}>
            <a href="#how">How it works</a>
            <a href="#features">Product</a>
            <a href="#proof">Proof</a>
            <a href="#pricing">Business model</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={s.navCta}>
            <Link href="/app" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link href="/app" className="btn btn-primary btn-sm">Open dashboard <ArrowRight size={14} /></Link>
          </div>
        </div>
      </header>

      <section className={s.hero}>
        <div className={s.heroBg} aria-hidden />
        <HeroFx />
        <div className={s.heroIn}>
          <Link href="/app/radar" className={s.pill}><span className="badge badge-info">New</span>Neighbourhood radar spots new dark stores <ArrowRight size={13} /></Link>
          <h1 className={s.h1}>
            <span className={s.line}><span className={s.word}>Never</span> <span className={s.word}>lose</span> <span className={s.word}>a</span></span>
            <span className={s.line}><RotatingWord className={`${s.word} serif`} /> <span className={s.word}>again.</span></span>
          </h1>
          <p className={s.lede}>
            Pehchaan turns the UPI payments every Paytm merchant already receives into Blinkit-grade customer intelligence — who&apos;s slipping away,
            who to win back, and what just opened down the road. Spoken in Kannada on the Soundbox.
          </p>
          <div className={s.ctas}>
            <Link href="/app" className="btn btn-primary btn-lg">Open live demo <ArrowRight size={16} /></Link>
            <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
          </div>
          <div className={s.trust}>
            <span><Check size={14} />Runs on payments merchants already receive</span>
            <span><Check size={14} />Backtested · {backtest.corr.toFixed(2)} correlation</span>
            <span><Check size={14} />ಕನ್ನಡ · हिंदी · English</span>
          </div>
        </div>

        <div className={s.stageHero}>
          <div className={s.frame}>
            <div className={s.chrome}><i /><i /><i /><span>app.pehchaan.in/today</span></div>
            <div className={s.mock}>
              <aside className={s.mSide}>
                <div className={s.mBrand}><Logo size={18} /><b>Pehchaan</b></div>
                {["Today", "Customers", "Win-back agent", "How it predicts", "Neighbourhood radar"].map((x, i) => <span key={x} className={i === 0 ? s.mOn : ""}>{x}</span>)}
              </aside>
              <div className={s.mMain}>
                <div className={s.mKpis}>
                  <div><small>Active regulars</small><b className="mono">{stats.active}</b></div>
                  <div><small>Slipping away</small><b className="mono">{winnable.length}</b></div>
                  <div><small>Spend walking away</small><b className="mono">{L(stats.atRisk)}/mo</b></div>
                  <div className={s.mGood}><small>Model accuracy</small><b className="mono">{backtest.corr.toFixed(2)}</b></div>
                </div>
                <div className={s.mGrid}>
                  <div className={s.mCard}><small>Weekly visits vs model expectation</small><CumulativeChart points={stats.weekly} fmt={(n) => Math.round(n).toString()} names={{ actual: "Visits", projected: "Expected" }} height={200} /></div>
                  <div className={s.mCard}><small>Your customers</small><Composition parts={stats.parts} fmt={(n) => Math.round(n).toString()} /></div>
                </div>
              </div>
            </div>
          </div>
          {top && <div className={`${s.float} ${s.f1}`}><span className={s.fDot} style={{ background: "var(--c-personal)" }} /><span><b>{top.c.name}</b><small>{gapText(top.avgGap)} · gone {Math.round(top.lastSeen)} days</small></span><em className="mono">{Math.round(top.pAlive * 100)}%</em></div>}
          <div className={`${s.float} ${s.f2}`}><Radar size={16} /><span><b>New store detected</b><small>{net.flaggedCount} shops losing regulars · same week</small></span></div>
          <div className={`${s.float} ${s.f3}`}><BellRing size={16} /><span><b>Back after 12 days</b><small>Soundbox: “Welcome back!”</small></span></div>
          <div className={`${s.float} ${s.f4}`}><Volume2 size={16} /><span className="kn">3 ಗ್ರಾಹಕರು ಈ ವಾರ ಬಂದಿಲ್ಲ</span></div>
        </div>
      </section>

      <section className={s.ticker} aria-label="Customers recognised">
        <div className={s.track}>
          {[...ticker, ...ticker].map((x, i) => (
            <span key={i} className={s.tItem}>
              <span className={s.tName}>{x.c.name}</span>
              <span className="mono">{x.c.visits.length} visits</span>
              <span className="badge"><span className="sw" style={{ background: SEGMENTS[x.segment].color }} />{SEGMENTS[x.segment].label}</span>
            </span>
          ))}
        </div>
      </section>

      <Recognition />

      <section className={s.problem}>
        <div className={s.problemIn}>
          <div className={s.pLeft}>
            <span className={s.eyebrow}>The problem</span>
            <h2 className={s.h2Dark}>Quick commerce is taking the kirana&apos;s best customers. In a recent survey,</h2>
            <div className={s.bigNum}><span data-num>0%</span><small> of shoppers said they rely less on their kirana</small></div>
            <p className={s.pText}>The kirana&apos;s only edge is the relationship. But a shopkeeper with 400 customers can&apos;t notice who stopped coming — until they&apos;re gone.</p>
            <div className={s.sign}><span>WHERE IS</span><span>SHARMA JI?</span></div>
          </div>
          <div className={s.pRows}>
            {[
              ["Customers leave silently", "Nobody cancels a kirana. They just order from an app one week, and don't come back. There's no signal — unless you're counting."],
              ["The data already exists", "Every UPI payment carries the customer's name and ID. Paytm sees it for ~1.5 crore subscription merchants — and today it's only used to say “payment received”."],
              ["One shop sees noise. Paytm sees a pattern.", "A dip at one kirana is a bad week. The same dip at seven shops around one point is a new dark store — and only the network can see it."],
            ].map(([t, d], i) => (
              <div key={t} className={s.pRow}>
                <span className="mono">0{i + 1}</span>
                <div><b>{t}</b><p>{d}</p></div>
              </div>
            ))}
            <p className={s.src}>Sources: Grant Thornton Bharat kirana survey via NEXT IAS (Jul 2026); Paytm subscription merchants via Inc42 (FY26)</p>
          </div>
        </div>
      </section>

      <section id="how" className={s.story}>
        <div className={s.storyIn}>
          <div className={s.storyLeft}>
            <span className={s.eyebrowDark}>How it works</span>
            <h2 className={s.h2}>From a payment <span className="serif">to a relationship.</span></h2>
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
                  {ticker.slice(0, 6).map((x) => (
                    <div key={x.c.id} className={`${s.vRow} ${s.vIn}`}><span className={s.vAv}>{x.c.name.split(" ").map((p) => p[0]).join("")}</span><span>{x.c.name}<small className={s.vSub}>{x.c.vpa}</small></span><span className="mono">{x.c.visits.length} visits</span><em>{gapText(x.avgGap)}</em></div>
                  ))}
                </div>
              )}
              {step === 1 && top && (
                <div className={s.vPredict}>
                  <div className={`${s.vCard} ${s.vIn}`}>
                    <b>{top.c.name}</b><small>{gapText(top.avgGap)} for {Math.round(top.rfm.tx / 30)} months · last seen {Math.round(top.lastSeen)} days ago</small>
                    <svg viewBox="0 0 300 90" className={s.vCurve}><path d="M0,12 C60,10 120,14 170,16 C200,18 215,30 235,52 C255,70 275,78 300,80" /><line x1="170" x2="170" y1="0" y2="90" /></svg>
                    <div className={s.vNums}><span><small>a month ago</small><b className="mono">{Math.round(top.pAlive30 * 100)}%</b></span><ArrowRight size={16} /><span><small>still a regular</small><b className="mono">{Math.round(top.pAlive * 100)}%</b></span></div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className={s.vAsk}>
                  <div className={`${s.vBubble} ${s.vIn}`}><span className={s.vBot}><Send size={14} /></span><p className="kn">ನಮಸ್ಕಾರ {top?.c.name.split(" ")[0]} ಅವರೇ! ಇವತ್ತು ತಾಜಾ ತರಕಾರಿ ಬಂದಿದೆ — ನಿಮಗಾಗಿ ₹30 ರಿಯಾಯಿತಿ, ಈ ವಾರ ಮಾತ್ರ.</p></div>
                  <div className={`${s.vWave} ${s.vIn}`}>{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ height: `${20 + Math.abs(Math.sin(i * 1.7)) * 70}%` }} />)}</div>
                  <div className={`${s.vReply} ${s.vIn}`}><p>Soundbox: “{top?.c.name.split(" ")[0]} is back after 12 days.”</p><span className="badge badge-good"><Check size={12} />Won back</span></div>
                </div>
              )}
              {step === 3 && (
                <div className={s.vMap}>
                  <svg viewBox="-2400 -2400 4800 4800" className={s.vIn}>
                    <rect x={-2400} y={-2400} width={4800} height={4800} fill="var(--surface)" />
                    {net.merchants.map((m) => <circle key={m.id} cx={m.x} cy={m.y} r={m.self ? 110 : 80} fill={m.flagged ? "var(--bad)" : "var(--border-strong)"} stroke="#fff" strokeWidth={18} />)}
                    <circle cx={net.inferred.x} cy={net.inferred.y} r={net.inferred.decayM * 2} fill="var(--bad)" fillOpacity={0.12} stroke="var(--bad)" strokeWidth={10} strokeDasharray="30 24" />
                  </svg>
                  <div className={`${s.vMapNote} ${s.vIn}`}><b>{net.flaggedCount} shops</b> lost regulars the same week → source located within ~{Math.round(net.inferred.errorM / 50) * 50} m</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={s.section}>
        <div className={s.head}>
          <span className={s.eyebrowDark}>Product</span>
          <h2 className={`${s.h2} ${s.reveal}`}>The customer intelligence <span className="serif">Blinkit has</span> — for the shop next door.</h2>
        </div>
        <div className={s.bento}>
          <div className={`${s.tile} ${s.tWide}`}>
            <div className={s.tHead}><LineChart size={18} /><b>Churn probability for every customer</b></div>
            <p>Not “hasn&apos;t come in 30 days”. A daily regular gone for a week matters more than a monthly one gone for a month — the model knows the difference.</p>
            <ul className={s.tRisk}>
              {winnable.slice(0, 3).map((x) => (
                <li key={x.c.id}><b>{x.c.name}</b><span>{gapText(x.avgGap)} · gone {Math.round(x.lastSeen)}d</span><span className="badge badge-warn">{Math.round(x.pAlive * 100)}% regular</span></li>
              ))}
            </ul>
          </div>
          <div className={s.tile}>
            <div className={s.tHead}><Volume2 size={18} /><b>Morning brief, in Kannada</b></div>
            <p>The Soundbox tells the owner who&apos;s slipping and who to expect — no app to open.</p>
            <div className={s.tWave}>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.06}s` }} />)}</div>
          </div>
          <div className={s.tile} id="proof">
            <div className={s.tHead}><BrainCircuit size={18} /><b>Backtested, not vibes</b></div>
            <p>Trained to June, tested on 75 days it never saw — and on real CDNOW purchase data it recovers the published model parameters within 3%.</p>
            <div className={s.tStrike}><small className="t3">predicted {Math.round(backtest.predicted).toLocaleString("en-IN")} visits · actual {backtest.actual.toLocaleString("en-IN")}</small><b className="mono">{backtest.corr.toFixed(2)}</b><small className="t3">per-customer correlation</small></div>
          </div>
          <div className={s.tile}>
            <div className={s.tHead}><Send size={18} /><b>Win-back agent</b></div>
            <p>Chooses who&apos;s worth an offer, writes it, sends it through the Paytm app, and confirms the return at the counter.</p>
            <div className={s.tSplit}><span style={{ flexGrow: 3 }}>Champions: no offer</span><span style={{ flexGrow: 2 }}>Slipping: ₹30</span></div>
          </div>
          <div className={`${s.tile} ${s.tWide}`}>
            <div className={s.tHead}><Radar size={18} /><b>Neighbourhood radar — for Paytm</b></div>
            <p>Regulars leaving many shops in the same week reveal a new competitor. Paytm can warn merchants, pre-fund offers and brief field teams before the damage spreads.</p>
            <ul className={s.tRisk}>
              {net.merchants.filter((m) => m.flagged).slice(0, 3).map((m) => (
                <li key={m.id}><b>{m.name}</b><span>{m.cat}</span><span className="badge badge-bad">{(m.drop * 100).toFixed(0)}% regulars</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={s.impact}>
        <div className={s.impactIn}>
          {[
            [backtest.corr.toFixed(2), "per-customer correlation on months the model never saw", "Model"],
            [`~${Math.round(net.inferred.errorM / 50) * 50} m`, "error locating a new dark store from aggregate drops alone", "Network"],
            [L(stats.atRisk), "a month in spend slipping away at one kirana — now visible", "Merchant"],
            ["1.5 Cr", "Paytm subscription merchants it can run on without new hardware", "Paytm"],
          ].map(([n, d, who]) => (
            <div key={d} className={`${s.iItem} ${s.reveal}`}><span className={s.iWho}>{who}</span><b>{n}</b><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section id="pricing" className={s.section}>
        <div className={s.head}>
          <span className={s.eyebrowDark}>Business model</span>
          <h2 className={`${s.h2} ${s.reveal}`}>Free to know your customers. <span className="serif">Paid to win them back.</span></h2>
        </div>
        <div className={s.plans}>
          {[
            { name: "Pehchaan", price: "Free", per: "with every Soundbox", feats: ["Every UPI customer recognised", "Slipping-away alerts", "Morning brief in Kannada", "Counter greetings"], cta: "Included", hl: false },
            { name: "Pehchaan Pro", price: "₹99", per: "per month", feats: ["Win-back agent", "Paytm app offers to lapsed customers", "Household & value insights", "Weekly results report"], cta: "Start 30-day trial", hl: true },
            { name: "Paytm network", price: "Take rate", per: "on merchant-funded offers", feats: ["Offers drive consumer-app opens", "Neighbourhood radar for sales teams", "Soundbox retention vs competitors", "Brand-funded kirana offers"], cta: "For Paytm teams", hl: false },
          ].map((p) => (
            <div key={p.name} className={`${s.plan} ${p.hl ? s.planHl : ""}`}>
              {p.hl && <span className={s.popular}>Pays for itself with one regular won back</span>}
              <b className={s.planName}>{p.name}</b>
              <div className={s.price}><span>{p.price}</span><small>{p.per}</small></div>
              <ul>{p.feats.map((f) => <li key={f}><Check size={14} />{f}</li>)}</ul>
              <Link href="/app" className={`btn ${p.hl ? "btn-primary" : "btn-secondary"}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className={s.section}>
        <div className={s.faqGrid}>
          <div className={s.head}>
            <span className={s.eyebrowDark}>FAQ</span>
            <h2 className={`${s.h2} ${s.reveal}`}>The hard <span className="serif">questions.</span></h2>
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

      <section className={s.cta}>
        <div className={s.ctaGlow} aria-hidden />
        <h2 className={s.reveal}>Never lose a <span className="serif">regular.</span></h2>
        <p className={s.reveal}>Open the live dashboard for Sri Manjunatha Stores, HSR Layout.</p>
        <div className={`${s.ctas} ${s.reveal}`}>
          <Link href="/app" className="btn btn-lg" style={{ background: "#fff", color: "var(--navy)" }}>Open dashboard <ArrowRight size={16} /></Link>
          <Link href="/app/radar" className={`btn btn-lg ${s.ghostDark}`}>See the radar</Link>
        </div>
      </section>

      <footer className={s.foot}>
        <div className={s.footIn}>
          <div className={s.brand}><Logo /><span>Pehchaan</span></div>
          <span>Built for Paytm Build for India AI Hackathon · Bengaluru 2026</span>
          <span>Sayantika Laskar &amp; Harsh Shukla · Gemini &amp; Sarvam AI</span>
        </div>
      </footer>
    </div>
  );
}
