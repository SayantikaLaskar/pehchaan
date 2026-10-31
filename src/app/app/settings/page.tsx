"use client";

import { useEffect, useState } from "react";
import { Bot, MessageCircle, Mic, RotateCcw } from "lucide-react";
import { merchantWa, setMerchantWa, waLink } from "@/lib/pehchaan/orders";
import { useApp } from "@/components/Providers";
import { LANGS, lines } from "@/lib/pehchaan/i18n";
import { SHOP } from "@/lib/pehchaan/sim";

export default function Settings() {
  const { status, reset, speak, speaking, lang, setLang } = useApp();
  const rows = [
    { icon: Bot, name: "Gemini", desc: "Writes win-back messages and the morning brief. Never decides who or how much.", on: status?.gemini, env: "GEMINI_API_KEY" },
    { icon: Mic, name: "Sarvam AI", desc: "Soundbox voice in Kannada, Hindi or English (Bulbul v3) and spoken questions (Saaras v4)", on: status?.sarvam, env: "SARVAM_API_KEY" },
  ];
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Shop</div></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
          <Field k="Shop" v={SHOP.name} />
          <Field k="Owner" v={SHOP.owner} />
          <Field k="Location" v={SHOP.area} />
          <Field k="Paytm UPI" v={SHOP.vpa} mono />
        </div>
      </div>
      <ShopWhatsApp />
      <div className="card" data-in>
        <div className="card-head"><div><div className="card-title">Soundbox voice</div><div className="card-sub">{LANGS.find((l) => l.k === lang)?.label} · morning brief at 7:30 am · counter greetings on</div></div></div>
        <div className="card-body" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="seg">{LANGS.map((l) => <button key={l.k} aria-pressed={lang === l.k} onClick={() => setLang(l.k)}>{l.label}</button>)}</div>
          <button className="btn btn-secondary btn-sm" disabled={speaking} onClick={() => speak(lines.hello())}>
            {speaking ? "Speaking…" : "Test voice"}
          </button>
        </div>
      </div>
      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Connections</div></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i ? "1px solid var(--border)" : 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--sunken)" }}><Icon size={16} /></span>
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{r.name}</b><br /><small className="t3">{r.desc}</small></span>
                {r.on ? <span className="badge badge-good">Connected</span> : <span className="badge">Offline · add {r.env}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Privacy</div></div>
        <div className="card-body" style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
          Pehchaan only uses the payer name and UPI ID that already appear on your Paytm for Business statement. Offers reach opted-in customers as Paytm app notifications — you never see or store their phone numbers. Consent, erasure and the audit log are in the Trust centre.
        </div>
      </div>
      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Demo</div></div>
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span className="t3" style={{ fontSize: 13 }}>Clear sent offers and results.</span>
          <button className="btn btn-secondary btn-sm" onClick={reset}><RotateCcw size={14} />Reset demo data</button>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="t3" style={{ fontSize: 12 }}>{k}</span>
      <span className={mono ? "mono" : ""}>{v}</span>
    </div>
  );
}

// The number customers' "Order on WhatsApp" buttons open. It travels inside each offer's QR.
function ShopWhatsApp() {
  const [v, setV] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => { const m = merchantWa(); setV(m); setSaved(m); }, []);
  return (
    <div className="card" data-in>
      <div className="card-head"><div><div className="card-title">Shop WhatsApp</div><div className="card-sub">Customers who can&apos;t come in order here · free, from your own WhatsApp Business app</div></div></div>
      <div className="card-body" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={v} onChange={(e) => setV(e.target.value)} inputMode="tel" placeholder="10-digit mobile number" style={{ height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "var(--font-mono), monospace", fontSize: 13, minWidth: 220 }} />
        <button className="btn btn-primary btn-sm" onClick={() => { const full = setMerchantWa(v); setV(full); setSaved(full); }}>Save</button>
        {saved && <a className="btn btn-secondary btn-sm" href={waLink(saved, "Test order from Pehchaan: 2 milk, 1 bread")} target="_blank" rel="noreferrer"><MessageCircle size={13} />Test the link</a>}
      </div>
    </div>
  );
}
