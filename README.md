# Pehchaan — never lose a regular

Customer intelligence for Paytm merchants, built from the UPI payments they already receive.

**Live demo:** https://pehchaan-sigma.vercel.app · **Pitch deck (PDF):** [docs/Pehchaan-Pitch-Deck.pdf](docs/Pehchaan-Pitch-Deck.pdf) · **Demo video:** [docs/Pehchaan-Demo.mp4](docs/Pehchaan-Demo.mp4)

- **Recognise:** every Soundbox payment (payer name + UPI ID) becomes a customer profile.
- **Predict:** a probabilistic churn model (MBG/NBD + Gamma-Gamma, chosen over BG/NBD and simple rules in an out-of-sample comparison) scores each customer's chance of still being a regular, their expected visits, and their 90-day value.
- **Act:** a win-back agent picks who's worth an offer, writes to them in Kannada (Gemini), sends it through the Paytm app, and recognises them on the Soundbox when they return (Sarvam voice).
- **See the city (Paytm view):** when regulars leave many shops in the same week, the network triangulates the cause, e.g. a new quick-commerce dark store.

Paytm Build for India AI Hackathon, Bengaluru, 31 Oct 2026 · Track 1, Merchant Growth AI (with a Track 3 autonomous agent)
Team: Sayantika Laskar, Harsh Shukla

## Run

```bash
npm install
cp .env.example .env    # add free keys (optional)
npm run dev             # http://localhost:3000
npm run model:check     # fit the models and print the backtest
npm run sarvam:check    # one Kannada TTS → STT round trip
npm run validate:cdnow  # fit BG/NBD on real CDNOW data and compare with the published parameters
```

| Key | Get it free | Used for | Without it |
|---|---|---|---|
| `GEMINI_API_KEY` | aistudio.google.com | Writes win-back messages and the morning brief | Kannada templates |
| `GEMINI_MODEL` / `GEMINI_THINKING` | optional | Default `gemini-3.5-flash-lite` (falls back to `gemini-3.6-flash` on quota), thinking `low` | — |
| `SARVAM_API_KEY` | dashboard.sarvam.ai | Soundbox voice in Kannada / Hindi / English (Bulbul v3) and spoken questions (Saaras v4) | Browser voice; tap-to-ask questions |
| `MONGODB_URI` (+ optional `MONGODB_DB`, default `pehchaan`) | MongoDB Atlas free tier | Live phone loop: offer links, opens, redemptions and opt-outs shared across servers (offers expire after 7 days) | Upstash if set, else in-memory (works locally only) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` (or `KV_REST_API_URL` / `_TOKEN`) | Vercel → Storage → Upstash Redis | Alternative store for the live loop | In-memory store |

Every Gemini call is cached and raced against a timeout, falling back to a template, so the demo never stalls on the free tier.

## Proof, not vibes (`npm run model:check`)

All numbers come from a deterministic simulation of one HSR Layout kirana: 420 customers, 14k payments, Nov 2025 → Oct 2026, with a dark store opening on 18 Aug.

| Check | Result |
|---|---|
| Backtest: train to 1 Jun, predict 1 Jun–15 Aug | 2,882 predicted vs 2,899 actual visits (−0.6%) |
| Who-left ranking (AUC, `npx tsx scripts/compare-models.ts`) | 0.95 on the shop · 0.77 on real CDNOW data (plain BG/NBD: 0.32 on CDNOW) |
| Per-customer correlation | 0.92 |
| Top 10% of customers by model | made 41% of holdout visits |
| Visits vs expectation after the opening | −47% within 500 m · −19% at 0.5–1 km · ~0% beyond 1 km |
| Network radar | 7 of 36 shops flagged; change point in the week of 17 Aug; source located within ~360 m |
| **Real data — CDNOW** (`npm run validate:cdnow`) | Fitted parameters within 3% of Fader, Hardie & Lee (2005): r 0.242 vs 0.243, α 4.394 vs 4.414, a 0.814 vs 0.793, b 2.477 vs 2.426. Holdout: 1,631 predicted vs 1,882 actual repeat purchases (−13%) |

The LLM never decides who or how much. It only writes the words. The win-back agent picks the offer size by Thompson sampling over ₹20 / ₹30 / ₹50 and learns from every redemption.

## Screens

| Route | What it shows |
|---|---|
| `/` | Landing: 3D product preview, pinned scroll story, proof, business model, FAQ |
| `/app` | Today: KPIs, visits vs model expectation, Kannada morning brief, slipping-away list, counter recognition |
| `/app/customers` | Every customer, with segment, probability of still being a regular, and value; drawer with the decay curve and household |
| `/app/winback` | The agent: plan → Kannada messages → send → simulated returns and ₹ recovered |
| `/app/model` | Backtest chart, fitted parameters, a worked example, and where the LLM is (and isn't) used |
| `/app/radar` | Paytm view: map with a week-by-week scrubber, inferred dark store, and a ground-truth reveal |
| `/app/import` | Your data: upload a Paytm payment export (CSV), map columns, score your own customers — in the browser |
| `/app/trust` | Trust centre: RBI / NPCI / DPDP / TRAI principles, what the LLM sees, consent ledger, audit log |
| `/app/business` | Business case: interactive calculator of value to Paytm and to one merchant |
| `/kiosk` | Full-screen Soundbox: live payments greeted aloud, voice questions, Kannada / Hindi / English |
| `/o/[code]` | The customer's phone: Paytm-style offer with Redeem and Stop offers |

## Edge cases: lockdowns, outages, no network, can't visit

| Situation | What Pehchaan does | Proof |
|---|---|---|
| **City-wide shock** (COVID-style lockdown, floods, bandh) | Paytm's network sees ≥ 50% of shops drop the same week with no spatial source → classified *city-wide*. The model switches to **business time** (lockdown days count only for the trade that happened), discount offers pause, the agent switches to WhatsApp ordering + delivery. | 34/35 shops, spatial R² 0.00 → city-wide. Worst-week false churn alarms **47 → 3** (`npm run resilience:check`) |
| **Local shock** (a dark store opens) | Few shops, strong distance pattern → *local*: real churn, win-back offers and the radar. | 6/35 shops, R² 0.71 → local |
| **Soundbox / network outage** | One shop at zero while peers trade → *outage*: its scores freeze, events backfill with real times when it reconnects. | False alarms **18 → 1** |
| **No network at the shop** | Offline-first PWA (service worker), churn model runs in the browser, actions queue in an outbox and sync on reconnect; offers are minted on-device and carried inside the QR. | DevTools → Offline → Run agent |
| **Rural, zero bars** | Ad-hoc local links: offer in the QR (shop → customer), **redeem by sound** (customer → shop, 2-second chirp, open-source [ggwave](https://github.com/ggerganov/ggwave), MIT), store-and-forward sync; offline UPI rails (UPI Lite X, UPI 123PAY) count as visits when they settle. | Tested: chirp decoded in-browser → win moment |
| **Customer can't come in** | "Order on WhatsApp" on every offer; orders arrive on `/app/orders`, are matched to the customer, priced (Kannada / Hindi / English), paid by a UPI deep link, and **count as a visit**. Free: wa.me links + UPI links; optional WhatsApp Cloud API webhook (`/api/whatsapp`) on Meta's free test number, replies free inside the 24-hour window. | Simulator + Cloud API payload tested |

## Live QR loop (show it to mentors)

1. Open `/app/winback` on the laptop and press **Run agent**. A QR appears in the Paytm notification card.
2. Scan it with any phone: the offer page opens and the dashboard shows **Opened on a phone** within ~2 s.
3. Tap **Redeem at the store**: the laptop plays the win moment and the Soundbox greets the customer by name. **Stop offers** records a consent withdrawal.

On Vercel this needs `MONGODB_URI` set so every serverless instance shares the same events.

## 3-minute demo

1. **`/` (30s):** "Quick commerce is taking the kirana's best customers, and the shopkeeper can't see who's leaving."
2. **`/app` (40s):** visits fall below the model's expectation from mid-August. Press **Play on Soundbox** to hear the morning brief in Kannada.
3. **`/app/customers` (30s):** open a slipping customer; their probability of still being a regular decays from 80% to 31%.
4. **`/app/winback` (40s):** **Run agent**, then **Hear it**, then **Simulate the next 7 days** to show who came back and the ₹ recovered. Back on Today, **Simulate payment**: "Aisha is back after 48 days."
5. **`/app/radar` (40s, the wow moment):** press play; the dots turn red week by week, the inferred store appears, then **Reveal ground truth**: about 360 m off.

Open `/app` and `/app/winback` about 30 seconds before presenting so Gemini's answers are cached.

## Code map

- `src/lib/pehchaan/sim.ts`: deterministic customer and payment simulation, including the dark-store shock
- `src/lib/pehchaan/btyd.ts`: BG/NBD and Gamma-Gamma (maximum-likelihood fit with Nelder–Mead), P(alive), expected visits
- `src/lib/pehchaan/model.ts`: scoring, segments, win-back priority, backtest, shock analysis
- `src/lib/pehchaan/network.ts`: multi-merchant baselines, CUSUM change points, spatial triangulation
- `src/lib/ai.ts`: Gemini (Interactions API, JSON schema) + Sarvam TTS, with cache, timeout and templates

The data is simulated for the demo; the models are real and run unchanged on real Paytm payment histories.
