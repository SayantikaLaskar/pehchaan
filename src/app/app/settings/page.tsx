"use client";

import { useState } from "react";
import { Bot, Languages, Mic, RotateCcw } from "lucide-react";
import { useApp } from "@/components/Providers";
import { MERCHANT } from "@/lib/data";

export default function Settings() {
  const { status, reset, speak, speaking } = useApp();
  const [lang, setLang] = useState("kn");
  const rows = [
    { icon: Bot, name: "Gemini", desc: "Reads notice photos, writes replies and questions", on: status?.gemini, env: "GEMINI_API_KEY" },
    { icon: Mic, name: "Sarvam AI", desc: "Kannada voice (Bulbul) and speech recognition (Saaras)", on: status?.sarvam, env: "SARVAM_API_KEY" },
  ];
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Business</div></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
          <Field k="Shop" v={MERCHANT.shop} />
          <Field k="Owner" v={MERCHANT.name} />
          <Field k="Location" v={MERCHANT.area} />
          <Field k="Paytm UPI" v={MERCHANT.vpa} mono />
        </div>
      </div>

      <div className="card" data-in>
        <div className="card-head">
          <div><div className="card-title">Voice language</div><div className="card-sub">What the Soundbox speaks when Kavach asks or explains</div></div>
          <Languages size={16} className="t3" />
        </div>
        <div className="card-body" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="seg">
            {[["kn", "ಕನ್ನಡ"], ["hi", "हिंदी"], ["en", "English"]].map(([k, l]) => (
              <button key={k} aria-pressed={lang === k} onClick={() => setLang(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" disabled={speaking} onClick={() => speak("ನಮಸ್ಕಾರ ಮಂಜುನಾಥ್ ಅವರೇ, ನಾನು ಕವಚ. ನಿಮ್ಮ ಲೆಕ್ಕ ನಾನು ನೋಡಿಕೊಳ್ಳುತ್ತೇನೆ.", "Hello Manjunath, I am Kavach. I'll take care of your accounts.")}>
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
                {r.on ? <span className="badge badge-good">Connected</span> : <span className="badge" title={`Add ${r.env} to .env.local`}>Offline · add {r.env}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" data-in>
        <div className="card-head"><div className="card-title">Demo</div></div>
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span className="t3" style={{ fontSize: 13 }}>Clear all answers and reclassifications.</span>
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
