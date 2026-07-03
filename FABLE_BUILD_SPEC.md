# FABLE_BUILD_SPEC.md — Visualizer → Sellable SaaS (Overview)

> **This is the overview.** The work is split into three executable build files — hand Fable one at
> a time, in order (each assumes the previous is merged):
> 1. **`FABLE_BUILD_1_foundation.md`** — abuse layer + Stripe billing + company branding
> 2. **`FABLE_BUILD_2_quoting.md`** — quote/proposal model + branded PDF + proposal page + watermark
> 3. **`FABLE_BUILD_3_growth.md`** — before/after slider + Good/Better/Best + lead capture + email + projects + analytics
>
> Read `AGENTS.md`, `ARCHITECTURE_MAP.md`, and `RECENT_LOG.md` first. Track progress in
> `RECENT_LOG.md` (Pass #). Do not violate the guardrails in §8. Sections §3–§5 below map to
> Builds 1–3 respectively; §7–§8 apply to all three.

## 0. Current state (what already exists — do not rebuild)

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase auth (email/password)
· Prisma + Postgres (Supabase) · Vercel Blob · self-rolled HTTP queue behind `QueueAdapter`
· two-phase worker: Claude Vision analysis → viability gate → fal.ai Flux Kontext generation
→ Blob storage. Deployed on Vercel (Hobby), working end-to-end on mobile.

Already built: auth (login/signup), `/dashboard` (history), `/new` (upload + camera + prompt +
seeded equipment catalog sending `equipment_id`), `/jobs/[id]` (status polling), `/renders/[id]`
(result + Download + Share + 1–5 ratings), `/settings` (account + data deletion), public
`/share/[token]` (before/after view), PWA manifest + icons, error/loading boundaries,
`after()`-based queue reliability, watchdog + cost-report crons, per-render cost tracking
(`RenderJob.cost_usd`, `fal_cost_usd`), budget guard (`RENDER_BUDGET_CAP_USD`).

Models today: `Organization`, `User`, `Project`, `Equipment`, `RenderJob`, `Render`
(+ enums `JobStatus`, `FailureReason`, `EquipmentCategory`). `Organization` and `Project`
exist but are **dormant** — this build activates them.

## 1. Goal

Turn the working demo into a product people pay for: billing + plan limits, company branding,
a brandable quote/proposal artifact that attaches to whatever quoting tool the contractor
already uses, lead capture, notifications, and a hardened anti-abuse/cost layer. This is the
"free tool" → "paid SaaS" jump.

## 2. Scope

**In (this build): abuse layer + Phase 1 + Phase 2.**
**Out (documented in §7 for later): FSM integrations (BYO-key), auto-quote smart-fill, spec-sheet tools, consumer B2C version.**

Positioning: this app stays **the Visualizer**. It does **not** try to replace the contractor's
existing quoting system — it produces a beautiful, brandable render + proposal that rides *inside*
their existing workflow (share link / PDF / later, pushed via their FSM API).

## 3. Abuse & cost protection (BUILD FIRST — cross-cutting)

Every render costs ~$0.07–0.08 (fal ~$0.055 + Claude ~$0.02). Free tier is the only real exposure.

1. **Re-enable email verification.** Update `signup/page.tsx`: after `signUp`, if
   `data.session == null`, show a "check your email to confirm" interstitial instead of pushing
   to `/dashboard`. (Supabase "Confirm email" must be turned back ON in the dashboard.)
2. **Block disposable-email domains** on signup (maintain a blocklist; reject on submit).
3. **Cloudflare Turnstile** (free CAPTCHA) on the signup form and on the render-submit action for
   free-tier users. Verify the token server-side in `/api/jobs` and the signup path.
4. **Rate limiting** on `POST /api/jobs` and `POST /api/uploads`, per-user and per-IP. Use Upstash
   Ratelimit (works on Vercel; add `UPSTASH_REDIS_REST_URL/TOKEN`). Sensible defaults, tunable via env.
5. **Plan-based monthly render caps** — the primary dollar gate (see §4 billing). Enforce in
   `/api/jobs` before enqueue: count the user's renders in the current billing period; if at limit,
   return 402 with an upsell payload (the UI shows an upgrade prompt).
6. **Per-account daily cost breaker.** Extend `DAILY_COST_ALERT_THRESHOLD_USD`: auto-pause an
   account (block new jobs, flag) when its daily spend exceeds a per-plan ceiling. Log + alert.
6b. **GLOBAL hard spend kill-switch.** `GLOBAL_DAILY_COST_CAP_USD` + `GLOBAL_RENDERS_PER_MINUTE`
   enforced via **atomic Redis counters with reserve-before-spend** (increment the estimated cost
   *before* the fal call; refuse + roll back if it would breach the cap; reconcile to actual after).
   Fail **closed** if Redis is down. System-wide, independent of per-account limits — a burst or a
   code loop cannot cross the global ceiling. Plus operator-set provider caps (fal.ai prepaid
   credits, Anthropic monthly limit, Vercel spend limit) as the bug-proof backstop.
7. **Content moderation** before any paid call. In the worker's Phase A, before the fal submit — or
   cheaply at submit time — classify prompt + image: reject NSFW/abusive and clearly off-domain
   requests (i.e. anything that isn't "place HVAC equipment in this space"). Prevents the app being
   used as a free general image generator. Complete such jobs as `failed` with a clear reason, no fal call.
8. **Card-on-file for paid tiers** (Stripe) — a credit card is the strongest bot filter; keep the
   free tier's cap tight because it has no card.
9. **Guardrail:** `PREVIEW_MODE` must never be `true` in production (it bypasses all auth). Add a
   startup assertion or a check in `requireUser` that refuses `PREVIEW_MODE` when `VERCEL_ENV=production`.

## 4. Phase 1 — Make it sellable

### 4a. Billing (Stripe)
- Integrate Stripe Checkout + Billing. Three plans (**launch prices — set low to win early
  customers; raise later, grandfathering existing users**):
  | Plan | Price | Renders/mo | Seats | Quoting | Branding | Watermark |
  |---|---|---|---|---|---|---|
  | Free | $0 | 5 | 1 | no | no | **yes** |
  | Pro | $29/mo | 150 | 1 | yes | logo | no |
  | Team | $49/mo | 300 | 3 | yes | org branding | no |
- Add `Subscription`/plan fields to `Organization` (owner-billed): `stripe_customer_id`,
  `stripe_subscription_id`, `plan` enum (`free|pro|team`), `plan_status`, `current_period_end`,
  `render_limit`, `seats`.
- Stripe **webhook** route (`/api/webhooks/stripe`) to sync subscription status → plan. Verify signature.
- **Customer portal** link from `/settings` (Stripe-hosted) for card/plan management.
- Usage metering: derive current-period render count from `RenderJob` (created within period) or a
  lightweight `UsageCounter`. Enforced in §3.5.

### 4b. Company profile & branding
- Activate `Organization`: on first login, create/attach an org owned by the user. Add fields:
  `logo_url`, `phone`, `license_number`, `address`, `brand_color`, `website`.
- New `/settings/company` (or a tab) to edit these + upload a logo (to Blob). Branding feeds quotes,
  share pages, and watermarks.

### 4c. Quote / proposal
- New `Quote` model: `id`, `job_id`/`render_id`, `user_id`, `org_id`, `customer_name`,
  `customer_email`, `line_items` (JSON: `[{description, qty, unit_price}]`), `notes`, `subtotal`,
  `tax_rate`, `tax`, `total`, `status` enum (`draft|sent|accepted|declined`), `share_token`,
  `share_expires_at`, `viewed_count`, timestamps. **Structured line items** so §7 auto-fill can
  populate them later.
- From `/renders/[id]`, a "Create proposal" flow: customer name/email + line items + tax → save.
- **Branded PDF**: render image + before/after + company branding + customer info + line-item table
  + total + notes. **Use `@react-pdf/renderer` or `pdf-lib`, NOT Puppeteer/Chromium** (headless
  browsers are heavy/fragile on Vercel serverless). Downloadable + attachable.
- Extend `/share/[token]` (or a new `/proposal/[token]`) to render the proposal for the customer,
  with an **Accept** action (sets `status=accepted`, `Render.quote_accepted=true`).

### 4d. Free-tier watermark
- For free-plan users, composite a semi-transparent brand/watermark onto the result image (sharp
  overlay) in both finalize paths (`workers/render-job.ts` and the eager-finalize in
  `app/api/jobs/[id]/route.ts`). Gate by the org's plan.

## 5. Phase 2 — Growth & stickiness

- **Before/after slider** component (interactive draggable) on `/renders/[id]`, `/share/[token]`,
  and the proposal page — replaces the static side-by-side.
- **Good / Better / Best**: let a proposal bundle multiple renders/options with per-option pricing,
  shown side by side on the customer page.
- **Lead capture**: on the public share/proposal page, a "Request a quote / Contact us" form →
  new `Lead` model (`name`, `phone`, `email`, `message`, `render_id`/`quote_id`, `org_id`,
  `created_at`, `status`) → notify the contractor (email). Turns every shared render into a lead.
- **Email notifications** via **Resend** (`RESEND_API_KEY`): render complete, "your customer viewed
  the proposal", new lead. Also finally implement the deferred weekly cost-report email
  (`app/api/cron/cost-report/route.ts` TODO).
- **Projects**: activate `Project` — group jobs/renders under a customer/job; project picker in
  `/new`; filter `/dashboard` by project.
- **Analytics**: a dashboard tab — renders used vs limit, proposals sent/viewed/accepted, acceptance
  rate (from `Quote.status`, `Render.quote_accepted`, `share`/`viewed_count`).

## 6. Data model changes (Prisma)

New: `Quote`, `Lead`, plan/Stripe fields + branding fields on `Organization`, optional `UsageCounter`.
Enums: `PlanTier (free|pro|team)`, `QuoteStatus`, `LeadStatus`. Activate `Organization`/`Project`
relations. Provide a Prisma migration (the repo currently uses `prisma db push` + a hand-run
`init.sql`; either continue with `db push` or introduce tracked migrations — pick one and document it).

## 7. Roadmap — design for these, do NOT build in this pass

- **FSM integrations (bring-your-own-API-key)**: customer pastes their own ServiceTitan (then Jobber /
  Housecall Pro / Workiz / Zoho) credentials; we push the render/PDF as an attachment to their
  estimate. **Store credentials encrypted at rest** (add an `IntegrationCredential` model with
  encrypted fields; never plaintext). Still one build per FSM — start with ServiceTitan. Also a
  **Zapier/Make** app as a universal bridge, and **QuickBooks** export.
- **Auto-quote smart-fill**: Google Maps property lookup + HVAC sizing → auto-populate the `Quote`
  line items. The structured `Quote.line_items` model from §4c is designed to accept this.
- Manufacturer **paid placement** in the equipment catalog.

## 8. Non-negotiable guardrails (from AGENTS.md)

- **Budget guard**: verify `estimatedCost <= RENDER_BUDGET_CAP_USD` before any paid API call; fail
  without retry if over.
- **Viability gate**: `request_viable === false && !force_generate` → complete without fal.ai.
- **Queue abstraction**: always use `QueueAdapter`; never call the queue transport directly.
- **Auth scope**: every DB query scoped to the authenticated user/org; never leak another tenant's data.
- **`PREVIEW_MODE` off in production** (see §3.9).
- Keep the `after()` queue-reliability model intact; don't reintroduce fire-and-forget `setTimeout`.
- Update `RECENT_LOG.md` after each major change.

## 9. Verification

- Stripe **test mode**: sign up → subscribe to Pro → plan reflects; cancel → downgrades.
- Hit the free-tier render cap → `/api/jobs` returns 402 → UI shows upgrade prompt.
- Free-tier render carries a **watermark**; Pro render does not.
- Create a **proposal** → PDF downloads with branding + line items + total; share link shows it;
  customer **Accept** flips status and `quote_accepted`.
- **Lead** form on the share page emails the contractor.
- **Rate limit**: rapid repeated submits get throttled; **Turnstile** blocks a scripted signup;
  a disposable-email signup is rejected; an **off-topic** prompt is refused before any fal spend.
- Email confirmation is back ON: a fresh signup must confirm before it can render.
- `npm run lint && npm run build` clean; end-to-end render still works on mobile.
