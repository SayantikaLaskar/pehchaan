"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Download, FileSpreadsheet, Lock, RotateCcw, Upload } from "lucide-react";
import { Composition } from "@/components/charts";
import { maskVpa } from "@/lib/pehchaan/consent";
import { analyseImport, build, detect, parseCSV, ROLE_LABEL, sampleExport, type Mapping, type Role } from "@/lib/pehchaan/importer";
import { SEGMENTS, type Segment } from "@/lib/pehchaan/model";
import { customers, rng } from "@/lib/pehchaan/sim";
import { L, gapText, inr } from "@/lib/pehchaan/use";
import s from "./import.module.css";

type Step = "upload" | "map" | "result";
const ROLES: Role[] = ["date", "time", "amount", "name", "vpa", "status"];
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export default function Import() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReturnType<typeof run> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const headers = rows[0] ?? [];
  const body = rows.slice(1);

  const load = (name: string, text: string) => {
    const r = parseCSV(text);
    if (r.length < 2) { setError("That file has no rows."); return; }
    setError("");
    setFile(name);
    setRows(r);
    setMap(detect(r[0]));
    setStep("map");
  };
  const onFile = async (f: File) => load(f.name, await f.text());
  const sample = () => load("paytm-export-sample.csv", sampleExport(customers(), rng(99)));
  const downloadSample = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([sampleExport(customers(), rng(99))], { type: "text/csv" }));
    a.download = "paytm-export-sample.csv";
    a.click();
  };

  function run() {
    const data = build(body, map);
    if (!data.customers.length) throw new Error("No usable payments — check the column mapping.");
    return { data, ...analyseImport(data) };
  }
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      try { setResult(run()); setStep("result"); setError(""); }
      catch (e) { setError(String((e as Error).message)); }
      setBusy(false);
    }, 30);
  };

  const ready = map.date != null && map.amount != null && (map.name != null || map.vpa != null);

  const view = useMemo(() => {
    if (!result) return null;
    const sc = result.scored;
    const active = sc.filter((x) => x.segment === "champion" || x.segment === "loyal").length;
    const win = sc.filter((x) => x.winnable).sort((a, b) => b.priority - a.priority);
    const parts = (Object.keys(SEGMENTS) as Segment[]).map((k) => ({ key: k, label: SEGMENTS[k].label, value: sc.filter((x) => x.segment === k).length, color: SEGMENTS[k].color }));
    return { active, win, parts, atRisk: win.reduce((a, x) => a + x.monthly, 0) };
  }, [result]);

  const exportList = () => {
    if (!view) return;
    const csv = ["customer,upi_id_masked,usually,last_seen_days,p_still_regular,monthly_spend", ...view.win.map((x) => [`"${x.c.name}"`, maskVpa(x.c.vpa), gapText(x.avgGap), Math.round(x.lastSeen), x.pAlive.toFixed(2), Math.round(x.monthly)].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "pehchaan-winback-list.csv";
    a.click();
  };

  return (
    <div className={s.page}>
      <div className={s.banner} data-in><Lock size={14} />Processed entirely in your browser — the file is never uploaded to any server.</div>

      <ol className={s.steps} data-in>
        {(["upload", "map", "result"] as Step[]).map((k, i) => (
          <li key={k} className={step === k ? s.on : ["upload", "map", "result"].indexOf(step) > i ? s.done : ""}><span>{i + 1}</span>{["Upload", "Map columns", "Results"][i]}</li>
        ))}
      </ol>

      {step === "upload" && (
        <section className={s.uploadGrid}>
          <div className={`card ${s.drop}`} data-in onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
            <span className={s.icon}><Upload size={22} /></span>
            <b>Drop your Paytm payment export (CSV)</b>
            <span className="t3">Paytm for Business → Reports → Transactions → Download. Any CSV with a date, amount and payer works.</span>
            <span className="btn btn-secondary btn-sm">Choose file</span>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
          <div className="card" data-in>
            <div className="card-head"><div className="card-title">No export handy?</div></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="t2" style={{ fontSize: 13 }}>Try the importer with a Paytm-format export of the demo shop — 14k+ payments, failed payments and same-day repeats included.</p>
              <button className="btn btn-primary" onClick={sample}><FileSpreadsheet size={14} />Use sample export</button>
              <button className="btn btn-ghost btn-sm" onClick={downloadSample}><Download size={14} />Download it to inspect</button>
            </div>
          </div>
          {error && <p className={s.error}>{error}</p>}
        </section>
      )}

      {step === "map" && (
        <section className="card" data-in>
          <div className="card-head">
            <div><div className="card-title">Match your columns</div><div className="card-sub">{file} · {body.length.toLocaleString("en-IN")} rows · detected automatically, change anything that&apos;s wrong</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("upload")}><RotateCcw size={13} />Different file</button>
          </div>
          <div className={s.mapGrid}>
            {ROLES.map((r) => (
              <label key={r}>
                <span>{ROLE_LABEL[r]}</span>
                <select className="input" value={map[r] ?? ""} onChange={(e) => setMap({ ...map, [r]: e.target.value === "" ? undefined : +e.target.value })}>
                  <option value="">— none —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className={s.preview}>
            <table>
              <thead><tr>{headers.map((h, i) => <th key={i} className={Object.values(map).includes(i) ? s.used : ""}>{h}</th>)}</tr></thead>
              <tbody>{body.slice(0, 5).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={Object.values(map).includes(j) ? s.used : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className={s.bar}>
            <span className="t3">{ready ? "Ready — failed payments are skipped and same-day payments count as one visit." : "Map at least date, amount and payer name or UPI ID."}</span>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={go}>{busy ? "Scoring…" : <>Score my customers <ArrowRight size={14} /></>}</button>
          </div>
          {error && <p className={s.error}>{error}</p>}
        </section>
      )}

      {step === "result" && result && view && (
        <>
          <section className={s.kpis}>
            <div className="card" data-in><span>Customers recognised</span><b className="mono">{result.scored.length.toLocaleString("en-IN")}</b><small>{result.data.payments.toLocaleString("en-IN")} payments · {result.data.skipped} skipped</small></div>
            <div className="card" data-in><span>Active regulars</span><b className="mono">{view.active}</b><small>{day(result.data.from)} → {day(result.data.to)}</small></div>
            <div className="card" data-in><span>Slipping away</span><b className={`mono ${s.warn}`}>{view.win.length}</b><small>{L(view.atRisk)} a month in spend</small></div>
            <div className="card" data-in><span>Model check on your data</span><b className="mono">{result.backtest ? result.backtest.corr.toFixed(2) : "—"}</b><small>{result.backtest ? `predicted ${Math.round(result.backtest.predicted)} vs ${result.backtest.actual} visits in last 60 days` : "needs 5+ months of history"}</small></div>
          </section>
          <section className={s.two}>
            <div className="card" data-in>
              <div className="card-head">
                <div><div className="card-title">Win back first</div><div className="card-sub">From your data · ranked by monthly spend × probability they&apos;ve left</div></div>
                <button className="btn btn-secondary btn-sm" onClick={exportList}><Download size={14} />Export list</button>
              </div>
              <div className={s.th}><span>Customer</span><span>Usually</span><span>Last seen</span><span>Still a regular</span><span>Monthly</span></div>
              {view.win.slice(0, 12).map((x) => (
                <div key={x.c.id} className={s.tr}>
                  <span className={s.who}><b>{x.c.name}</b><small className="mono">{maskVpa(x.c.vpa)}</small></span>
                  <span className="t2">{gapText(x.avgGap)}</span>
                  <span className="mono">{Math.round(x.lastSeen)}d</span>
                  <span className="mono">{Math.round(x.pAlive * 100)}%</span>
                  <span className="mono">{inr(x.monthly)}</span>
                </div>
              ))}
            </div>
            <div className="card" data-in>
              <div className="card-head"><div className="card-title">Your customers</div><button className="btn btn-ghost btn-sm" onClick={() => { setStep("upload"); setResult(null); }}><RotateCcw size={13} />New file</button></div>
              <div className="card-body"><Composition parts={view.parts} fmt={(n) => Math.round(n).toString()} /></div>
              <p className={s.fit}>Fitted on your data: visit rate {((result.bg.r / result.bg.alpha) * 7).toFixed(2)}/week · {((result.bg.a / (result.bg.a + result.bg.b)) * 100).toFixed(1)}% chance of leaving after a visit · average basket {inr((result.gg.p * result.gg.v) / (result.gg.q - 1))}</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
