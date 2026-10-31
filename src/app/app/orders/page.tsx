"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Check, CheckCheck, ExternalLink, Megaphone, MessageCircle, PlugZap, Send, Truck } from "lucide-react";
import { useApp } from "@/components/Providers";
import { SEGMENTS, type Scored } from "@/lib/pehchaan/model";
import { confirmText, parseOrder, total, upiLink, waLink } from "@/lib/pehchaan/orders";
import { gapText, useLive } from "@/lib/pehchaan/use";
import { post } from "@/lib/outbox";
import s from "./orders.module.css";

interface Order { t: number; id: string; name?: string; from?: string; text?: string; via?: "cloud-api" | "simulator" }
const KEY = "pehchaan.orders.v1";
const CHIPS = ["2 ಹಾಲು, 1 ಬ್ರೆಡ್, 6 ಮೊಟ್ಟೆ", "1 kg rice, 1 dal, 2 milk, 1 oil", "दो दूध और एक ब्रेड, आधा किलो प्याज"];

export default function Orders() {
  const { scored } = useLive();
  const { log, sent, markReturned } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [cloud, setCloud] = useState<boolean | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Opted-in regulars the model says are slipping — the people worth inviting to order instead.
  const regulars = useMemo(() => scored.filter((x) => x.segment === "at_risk" || x.segment === "lost" || x.segment === "loyal").sort((a, b) => b.monthly - a.monthly).slice(0, 12), [scored]);
  const [who, setWho] = useState<string>("");
  useEffect(() => { if (!who && regulars[0]) setWho(regulars.find((x) => x.c.name.startsWith("Aisha"))?.c.id ?? regulars[0].c.id); }, [regulars, who]);
  const [text, setText] = useState(CHIPS[0]);

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}
    fetch("/api/whatsapp").then((r) => r.json()).then((j) => setCloud(!!j.cloudApi)).catch(() => setCloud(false));
    let stop = false;
    const tick = async () => {
      try {
        const { events } = (await fetch("/api/offers/events?since=0", { cache: "no-store" }).then((r) => r.json())) as { events: (Order & { type: string })[] };
        setOrders(events.filter((e) => e.type === "order").sort((a, b) => b.t - a.t));
      } catch {}
      if (!stop) setTimeout(tick, 2500);
    };
    tick();
    return () => { stop = true; };
  }, []);

  useGSAP(() => { gsap.from(`.${s.order}:first-child`, { y: -16, autoAlpha: 0, duration: 0.6, ease: "expo.out" }); }, { scope: root, dependencies: [orders[0]?.t] });

  const match = (o: Order): Scored | undefined => scored.find((x) => x.c.id === o.id) ?? (o.name ? scored.find((x) => x.c.name.toLowerCase() === o.name!.toLowerCase()) ?? scored.find((x) => x.c.name.split(" ")[0].toLowerCase() === o.name!.split(" ")[0].toLowerCase()) : undefined);

  const send = async () => {
    const c = scored.find((x) => x.c.id === who);
    if (!c || !text.trim()) return;
    await post("/api/whatsapp/simulate", { id: c.c.id, name: c.c.name, text });
  };

  const deliver = (o: Order, cust: Scored | undefined, amount: number) => {
    const k = `${o.id}:${o.t}`;
    const next = { ...done, [k]: Date.now() };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    log({ actor: "Merchant", action: "WhatsApp order delivered", subject: cust?.c.id ?? o.id, detail: `₹${amount} paid by UPI on delivery — counted as a visit` });
    if (cust && sent[cust.c.id]?.returned == null && sent[cust.c.id]) markReturned(cust.c.id, true);
  };

  const sel = scored.find((x) => x.c.id === who);
  const preview = parseOrder(text);
  const invite = `ನಮಸ್ಕಾರ! ಶ್ರೀ ಮಂಜುನಾಥ ಸ್ಟೋರ್ಸ್ ಈಗ ಮನೆಗೆ ತಲುಪಿಸುತ್ತದೆ. ಈ ನಂಬರ್‌ಗೆ ನಿಮ್ಮ ಪಟ್ಟಿ WhatsApp ಮಾಡಿ — UPI ಮೂಲಕ ಪಾವತಿ.\nSri Manjunatha Stores now delivers — WhatsApp us your list, pay by UPI on delivery.`;

  return (
    <div className={s.page} ref={root}>
      <section className={s.kpis}>
        <div className="card" data-in><span className={s.kL}>Orders today</span><b className="mono">{orders.length}</b><small>{cloud ? "WhatsApp Cloud API connected" : "demo inbox · click-to-chat mode"}</small></div>
        <div className="card" data-in><span className={s.kL}>Delivered & paid</span><b className={`mono ${s.good}`}>{Object.keys(done).length}</b><small>each counts as a visit — no false churn</small></div>
        <div className="card" data-in><span className={s.kL}>Order value</span><b className="mono">₹{orders.reduce((a, o) => a + total(parseOrder(o.text ?? "")), 0).toLocaleString("en-IN")}</b><small>priced from the shop&apos;s list</small></div>
        <div className="card" data-in><span className={s.kL}>Cost to run</span><b className="mono">₹0</b><small>wa.me links + UPI deep links; Cloud API replies free in the 24-h window</small></div>
      </section>

      <div className={s.grid}>
        <section className="card" data-in>
          <div className="card-head"><div><div className="card-title">WhatsApp orders</div><div className="card-sub">For customers who can&apos;t or won&apos;t come to the counter — recognised, priced and paid by UPI</div></div><span className="badge badge-good"><MessageCircle />Live</span></div>
          <div className={s.list}>
            {orders.length === 0 && <p className={s.empty}>No orders yet. Send one from the customer&apos;s phone on the right →</p>}
            {orders.map((o) => {
              const cust = match(o);
              const items = parseOrder(o.text ?? "");
              const amount = total(items);
              const first = (cust?.c.name ?? o.name ?? "there").split(" ")[0];
              const k = `${o.id}:${o.t}`;
              return (
                <article key={k} className={s.order}>
                  <header>
                    <span className={s.av}>{(cust?.c.name ?? o.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                    <span className={s.who}><b>{cust?.c.name ?? o.name ?? "New customer"}</b><small>{o.from} · {new Date(o.t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {o.via === "cloud-api" ? "WhatsApp Cloud API" : "WhatsApp (demo)"}</small></span>
                    {cust ? <span className={s.tag} style={{ color: SEGMENTS[cust.segment].color }}>{SEGMENTS[cust.segment].label} · {Math.round(cust.pAlive * 100)}% regular · {gapText(cust.avgGap)}</span> : <span className={s.tag}>Not in Pehchaan yet</span>}
                  </header>
                  <p className={s.msg}>{o.text}</p>
                  {items.length > 0 ? (
                    <table className={s.items}><tbody>
                      {items.map((i) => <tr key={i.name}><td>{i.qty} {i.unit}</td><td>{i.name}</td><td className="mono">₹{Math.round(i.qty * i.price)}</td></tr>)}
                      <tr className={s.tot}><td /><td>Total</td><td className="mono">₹{amount}</td></tr>
                    </tbody></table>
                  ) : <p className={s.small}>Couldn&apos;t read the items — reply to confirm.</p>}
                  <footer>
                    {done[k] ? <span className={s.ok}><CheckCheck size={15} />Delivered · paid ₹{amount} by UPI · counted as {first}&apos;s visit</span> : (
                      <>
                        {o.via === "cloud-api"
                          ? <span className={s.small}><CheckCheck size={13} /> Confirmed automatically on WhatsApp</span>
                          : <a className="btn btn-secondary btn-sm" href={waLink(null, confirmText(first, items, amount).kn)} target="_blank" rel="noreferrer"><Send size={13} />Reply on WhatsApp</a>}
                        {amount > 0 && <UpiQr amount={amount} note={`Order ${first}`} />}
                        <button className="btn btn-primary btn-sm" onClick={() => deliver(o, cust, amount)}><Truck size={13} />Delivered & paid</button>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={s.side}>
          <div className={`card ${s.phone}`} data-in>
            <div className={s.pHead}><span className={s.wa}><MessageCircle size={14} /></span><span><b>Sri Manjunatha Stores</b><small>WhatsApp · customer&apos;s phone</small></span></div>
            <label className={s.pick}>Customer
              <select value={who} onChange={(e) => setWho(e.target.value)}>{regulars.map((x) => <option key={x.c.id} value={x.c.id}>{x.c.name} · {SEGMENTS[x.segment].label}</option>)}</select>
            </label>
            <div className={s.chat}>
              <p className={s.in}>{invite.split("\n")[0]}</p>
              <p className={s.out}>{text || "…"}</p>
              {preview.length > 0 && <p className={s.in}>{confirmText(sel?.c.name.split(" ")[0] ?? "", preview, total(preview)).kn}</p>}
            </div>
            <div className={s.chips}>{CHIPS.map((c) => <button key={c} onClick={() => setText(c)} className={text === c ? s.chipOn : ""}>{c}</button>)}</div>
            <div className={s.compose}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type an order…" /><button onClick={send} aria-label="Send"><Send size={16} /></button></div>
          </div>

          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Tell regulars you deliver</div></div>
            <p className={s.side2}>One tap shares a Kannada + English note to a WhatsApp broadcast list or Status — free, from the merchant&apos;s own WhatsApp Business app. Used automatically when the network shows a city-wide shock.</p>
            <div className={s.pad}><a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noreferrer"><Megaphone size={13} />Share on WhatsApp<ExternalLink size={12} /></a></div>
          </div>

          <div className="card" data-in>
            <div className="card-head"><div className="card-title">Connect a real number (free)</div><span className={`badge ${cloud ? "badge-good" : "badge-info"}`}><PlugZap />{cloud ? "Connected" : "Optional"}</span></div>
            <ol className={s.steps}>
              <li>Meta for Developers → create an app → add <b>WhatsApp</b>. You get a free test number.</li>
              <li>Webhook URL <span className="mono">/api/whatsapp</span>, verify token <span className="mono">pehchaan-verify</span>, subscribe to <b>messages</b>.</li>
              <li>Set <span className="mono">WHATSAPP_TOKEN</span>, <span className="mono">WHATSAPP_PHONE_NUMBER_ID</span>, <span className="mono">WHATSAPP_APP_SECRET</span>.</li>
              <li>Customer messages are free to receive; Pehchaan&apos;s confirmation is a free service reply inside the 24-hour window.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function UpiQr({ amount, note }: { amount: number; note: string }) {
  const [src, setSrc] = useState("");
  const link = upiLink(amount, note);
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#06132b", light: "#ffffff" } }).then(setSrc); }, [link]);
  return (
    <span className={s.upi} title={link}>
      {src && <img src={src} alt={`UPI QR for ₹${amount}`} />}
      <small><Check size={11} />UPI ₹{amount}<br />scan on delivery</small>
    </span>
  );
}

