# Hisaab Kavach

**UPI is not income.** An AI bookkeeping and tax shield for Paytm merchants. It separates real sales from family money, loans, own transfers and refunds, so a GST notice never pushes a shopkeeper back to cash.

Paytm Build for India AI Hackathon, Bengaluru, 31 Oct 2026 · Track 1, Merchant Growth AI (with a Track 3 autonomous agent)
Team: Sayantika Laskar, Harsh Shukla

## Run

```bash
npm install
cp .env.example .env.local   # add free keys (optional)
npm run dev                  # http://localhost:3000
```

| Key | Where to get it (free) | Powers | Without it |
|---|---|---|---|
| `GEMINI_API_KEY` | aistudio.google.com → Get API key | Reads uploaded notice photos, drafts reply letters, writes Kannada questions | Sample notice + template letter + template questions |
| `GEMINI_MODEL` | optional | Override the model if one is rate-limited (default `gemini-3.6-flash`; `GEMINI_THINKING` = minimal|low|medium) | — |
| `SARVAM_API_KEY` | dashboard.sarvam.ai (free credits) | Kannada voice (Bulbul v3) and spoken answers (Saaras v4) | Browser voice; tap to answer |

The app works fully offline with no keys, so the demo can't break on stage.

## Product

| Route | What it is |
|---|---|
| `/` | Marketing site: 3D product preview, pinned scroll story, features, pricing, FAQ |
| `/app` | Overview: KPIs, cumulative turnover vs ₹40L limit, compliance status, composition, activity |
| `/app/transactions` | Data table: search, filter, export CSV, detail drawer with reason/signals/evidence, reclassify |
| `/app/review` | Soundbox: Kavach asks uncertain credits in Kannada; one tap or one word to answer |
| `/app/notices` | Notice shield: upload or sample → 5-step agent run → ₹7.71L demand → ₹0, waterfall, reply letter |
| `/app/forecast` | When you cross ₹40L, a growth-scenario slider, and what to do first |
| `/app/pulse` | Paytm view: an agent detects merchants drifting to cash and wins them back (simulated cohort) |
| `/app/settings` | Language, voice test, connection status, reset demo |
| `/notice-sample` | Printable sample notice (marked SAMPLE) to photograph on stage |

Shortcuts: `⌘K` search · FY switcher in the top bar.

## 3-minute demo

1. **`/` (30s):** scroll the hero and the "No UPI, only cash" problem section.
2. **`/app` (30s):** ₹30.6L received, only ₹24.3L business, crossing ₹40L in Feb 2027. Press **Explain in Kannada**.
3. **`/app/review` (30s):** press **Ask aloud** and answer two items. Turnover updates live.
4. **`/app/notices` (60s, the wow moment):** photograph the printed sample notice and upload it → the agent runs → **₹7,71,150 → ₹0** → waterfall → reply letter → **Explain to Manjunath**.
5. **`/app/pulse` (30s):** the autonomous agent log, with 71% of drifting merchants back on QR.

## Code map

- `src/lib/data.ts`: deterministic synthetic UPI history (Apr 2025 → today)
- `src/lib/classify.ts`: explainable classifier; low-confidence credits go to the merchant
- `src/lib/gst.ts`: Section 22 threshold, composition 1%, sales mix from purchases, forecast
- `src/lib/ai.ts`: Gemini (Interactions API, JSON schema output) + Sarvam REST, each with an offline fallback
- `src/components/charts.tsx`: SVG charts (validated colour-blind-safe palette, hover tooltips)

GST figures are simplified for a demo. Every draft is marked for CA review; nothing here is legal advice.
