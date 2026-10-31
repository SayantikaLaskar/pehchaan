"use client";

import { Bot, Mic, RotateCcw } from "lucide-react";
import { useApp } from "@/components/Providers";
import { SHOP } from "@/lib/pehchaan/sim";

export default function Settings() {
  const { status, reset, speak, speaking } = useApp();
  const rows = [
    { icon: Bot, name: "Gemini", desc: "Writes win-back messages and the morning brief. Never decides who or how much.", on: status?.gemini, env: "GEMINI_API_KEY" },
    { icon: Mic, name: "Sarvam AI", desc: "Kannada voice on the Soundbox (Bulbul v3)", on: status?.sarvam, env: "SARVAM_API_KEY" },
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
      <div className="card" data-in>
        <div className="card-head"><div><div className="card-title">Soundbox voice</div><div className="card-sub">Kannada · morning brief at 7:30 am · counter greetings on</div></div></div>
        <div className="card-body">
          <button className="btn btn-secondary btn-sm" disabled={speaking} onClick={() => speak("ನಮಸ್ಕಾರ ಮಂಜುನಾಥ್ ಅವರೇ, ನಾನು ಪೆಹಚಾನ್. ನಿಮ್ಮ ಗ್ರಾಹಕರನ್ನು ನಾನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತೇನೆ.", "Hello Manjunath, I'm Pehchaan. I'll remember your customers for you.")}>
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
