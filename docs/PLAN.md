# Pehchaan — improvement plan

Backup of the submitted version: tag `v1-submission`, branch `backup/v1-submission`, zip in `../backups/`.

## Decisions

| Topic | Choice |
|---|---|
| Timeline | Two working days, with review rounds |
| Narrator | Sarvam Bulbul v3, Indian English (existing key) |
| Music | HeyGen catalog (needs the `heygen` CLI, signed in) |
| Live phone loop | Upstash Redis through the Vercel Marketplace (free tier) |

## Part 1 — Product

Order matters: each phase ships to `main` (and auto-deploys) before the next starts.

### Phase A — Trust & compliance (RBI · NPCI · DPDP)
Confirm the exact clauses with Paytm's compliance team before the pitch; the product states principles, not legal advice.

- **Trust centre page** (`/app/trust`): one card per rule with what Pehchaan does about it.
  - RBI *Storage of Payment System Data* (2018): payment data stays in India; models run on India-region infra; the LLM never receives payment data (only first name, usual item, offer).
  - DPDP Act 2023 + Rules: notice, consent, purpose limitation, minimisation, withdrawal, retention, erasure.
  - NPCI/UPI data-sharing norms: merchant sees only what is already on their Paytm statement; no phone numbers; offers only via Paytm's app.
  - TRAI commercial-communication rules / WhatsApp opt-in: message only opted-in customers; one offer per customer per month.
  - Not credit: loyalty scoring only — never creditworthiness, never shared with lenders (keeps clear of RBI digital-lending rules).
- **Consent ledger**: per-customer opt-in status + date + channel; withdraw and "erase customer" actions.
- **Masking**: UPI IDs masked everywhere by default (`aisha.p••@oksbi`).
- **Retention**: 180-day window; older payments excluded from scoring.
- **Audit log**: every agent action (who, why, what was sent, outcome), exportable.
- Agent only targets opted-in customers; frequency cap enforced.

### Phase B — Business case page (`/app/business`)
- Interactive calculator for Paytm: merchant base → adoption → Pro conversion → offer volume → annual revenue, Soundbox retention value, consumer-app opens. Every assumption labelled and editable.
- Per-merchant view: monthly spend recovered vs ₹99 Pro.

### Phase D — Live phone loop
- Win-back creates a short link + QR (`/o/[code]`).
- Phone page: a "Paytm notification" with the Kannada offer and **Redeem at store**.
- Redeem writes to Upstash; the dashboard polls and flips the customer to **Won back**; the Soundbox greets them by name.
- Setup (once, by you): Vercel dashboard → project `pehchaan` → Storage → Upstash Redis → Connect. Env vars are added automatically.

### Phase C — Real data
- "Upload your Paytm statement" (CSV) with a column-mapping step; parsed and scored in the browser (data never leaves the device).
- Sample file in real export format.

### Phase E — Smarter agent (Track 3)
- Offer learning: Thompson-sampling bandit over ₹20 / ₹30 / ₹50, updated from redemptions; posterior shown on the page. Replaces the assumed response curve.
- Soundbox voice question: Sarvam STT → intent → answer from the model → Sarvam TTS ("ಈ ವಾರ ಯಾರು ಬಂದಿಲ್ಲ?").

### Phase F — Polish
- Language toggle: Kannada / Hindi / English for voice and messages.
- Full-screen Soundbox kiosk mode (`/kiosk`) for stage and video.
- Model page: "matches `lifetimes` reference" check (Python script, results committed).

## Part 2 — Demo video (HyperFrames, ~3:30, 1920×1080, 30 fps)

1. **Storyline**: three distinct options in words; you pick one.
2. **Script**: narration (Indian English, Sarvam) timed to scenes; Kannada product voice lines kept diegetic.
3. **Capture**: Puppeteer drives the live portal (after Phase F) and records each segment; it logs the bounding box of every element it touches so zooms land exactly.
4. **Build**: HyperFrames compositions — kinetic-type cold open, problem/insight motion graphics, the portal recordings (≈60% of runtime) with exact punch-ins, animated cursor and clicks, burned-in captions, close card.
5. **Sound**: HeyGen catalog bed under the voice (~0.14), sparse SFX on real on-screen actions, measured loudness.
6. **Review**: you edit in the HyperFrames desktop app preview; final render to MP4.

| Time | Scene |
|---|---|
| 0:00–0:20 | Cold open — "Sharma ji came every 2 days. Then he stopped." |
| 0:20–0:45 | Problem — 51% counter, quick-commerce pressure |
| 0:45–1:00 | Insight — a UPI payment carries a name, across 1.5 Cr merchants |
| 1:00–3:00 | Live portal — Today (Kannada brief) → customer decay → backtest → win-back → QR redeem → Won back → radar reveal → Trust centre → Business case |
| 3:00–3:30 | Close — impact numbers, "Never lose a regular.", links |

## What we need from you

1. **HeyGen**: install the CLI (https://developers.heygen.com/cli) and run `heygen auth login --oauth` (free allowance).
2. **Upstash**: connect it to the `pehchaan` project in the Vercel dashboard (Storage → Upstash Redis).
3. **Review points**: approve each phase on the live site; pick the video storyline; approve the video preview before the final render.

## Suggested schedule

| When | Work |
|---|---|
| Day 1 morning | Phase A, Phase B |
| Day 1 afternoon | Phase D, Phase C |
| Day 1 evening | Phase E, Phase F; deck updated |
| Day 2 morning | Video storyline → script → captures |
| Day 2 afternoon | Video build, your review, final render |
