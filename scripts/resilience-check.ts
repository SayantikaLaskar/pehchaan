// Prints how Pehchaan classifies three disruptions and how many false churn alarms business time avoids.
// Run: npx tsx scripts/resilience-check.ts
import { resilience } from "../src/lib/pehchaan/resilience";

const t0 = Date.now();
const r = resilience();
for (const k of ["local", "citywide", "outage"] as const) {
  const c = r[k];
  console.log(`${k.padEnd(9)} → classified ${c.kind.padEnd(8)} · ${c.flagged}/${c.total} shops flagged (${Math.round(c.breadth * 100)}%) · spatial R² ${c.spatial.toFixed(2)} · city activity ${Math.round(c.activity * 100)}% · onset ${c.onset}`);
}
for (const [k, a] of [["lockdown", r.lockdownAlarms], ["outage", r.outageAlarms]] as const) {
  console.log(`\n${k}: worst-week false alarms — calendar time ${a.peakNaive}, business time ${a.peakAware} (avoided ${a.falseAlarmsAvoided})`);
  console.log(a.weeks.map((w) => `${w.label}: ${w.baseline}/${w.naive}/${w.aware}`).join(" · "));
}
console.log(`\n${Date.now() - t0} ms`);
