# FABLE_BUILD_1 — Foundation: Abuse Layer + Billing + Branding

> Build 1 of 3. Read `AGENTS.md`, `ARCHITECTURE_MAP.md`, `RECENT_LOG.md`, and
> `FABLE_BUILD_SPEC.md` (overview) first. This is the first paid-SaaS build; nothing from
> Builds 2–3 exists yet. Track progress in `RECENT_LOG.md` (Pass #). Honor §Guardrails.

## Why this build
"Who can use it, what they pay, and who they are." Establishes the paying-customer plumbing and
the anti-abuse controls that protect render spend — everything later (quoting, watermark, limits)
depends on plan + org existing. **Build the abuse layer first**, then billing, then branding.

## External accounts needed (all have free tiers)
- **Stripe** (test mode) — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, price IDs
- **Cloudflare Turnstile** — `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- **Upstash Redis** (rate limiting) — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## 1. Abuse & cost protection (BUILD FIRST)
Every render costs ~$0.07–0.08 (fal ~$0.055 + Claude ~$0.02); the free tier is the only real exposure.
1. **Re-enable email verification.** In `signup/page.tsx`, after `signUp`, if `data.session == null`
   show a "check your email to confirm" interstitial instead of pushing to `/dashboard`. (Supabase
   "Confirm email" must be ON in prod.)
2. **Block disposable-email domains** on signup (blocklist, reject on submit).
3. **Cloudflare Turnstile** on the signup form and on the free-tier render submit; verify token
   server-side in the signup path and `POST /api/jobs`.
4. **Rate limiting** on `POST /api/jobs` and `POST /api/uploads`, per-user and per-IP (Upstash
   Ratelimit). Sensible defaults, tunable via env.
5. **Plan-based monthly render cap** — the primary dollar gate. In `/api/jobs`, before enqueue,
   count the org's renders in the current billing period; if at limit return **402** with an upsell
   payload; UI shows an upgrade prompt.
6. **Per-account daily cost breaker.** Extend `DAILY_COST_ALERT_THRESHOLD_USD`: track per-account
   daily spend; auto-pause an account (block new jobs + flag) when it exceeds a per-plan ceiling.
   Log + alert.
6b. **GLOBAL hard spend kill-switch (critical — must not be defeatable by a burst or a code loop).**
   Env: `GLOBAL_DAILY_COST_CAP_USD` (default e.g. 25) and `GLOBAL_RENDERS_PER_MINUTE` (default e.g. 20).
   - Keep an **atomic** global daily spend counter in Upstash Redis, keyed by day
     (`spend:global:YYYY-MM-DD`, TTL ~48h), plus a global per-minute render counter (sliding window).
   - **Reserve-before-spend:** before submitting to fal (the expensive call), atomically `INCRBY`
     the global counter by the job's *estimated* cost. If the new total would exceed
     `GLOBAL_DAILY_COST_CAP_USD`, `DECRBY` back and refuse the job (mark `failed`/blocked, surface a
     "temporarily unavailable" message). Reconcile the reserved estimate to actual cost after the
     job completes. This closes the race where concurrent jobs all pass an after-the-fact check.
   - Enforce the global per-minute cap the same way (refuse when exceeded).
   - **Fail closed:** if Redis is unreachable, refuse new paid work rather than spending blindly.
   - This is system-wide and independent of per-account limits — even if every account is legit, a
     viral spike or a bug in the pipeline cannot cross the global ceiling in a day.
6c. **Provider-level hard caps (out of app scope — instruct the operator, don't code):** the truest
   backstop is a cap a code bug can't cross. Document in `RECENT_LOG.md` that the operator must:
   use **fal.ai prepaid credits** (physical ceiling on the biggest cost), set an **Anthropic**
   monthly spend limit with auto-reload off, and set a **Vercel** spend-management limit.
7. **Content moderation** before any paid call — reuse the Claude Vision call already happening in
   worker Phase A to classify prompt + image; reject NSFW/abusive and clearly off-domain (anything
   that isn't "place HVAC equipment in a real space"). Complete as `failed` with a clear reason,
   **no fal call**. **Tune for low false-positives** — wrongly blocking a legit contractor photo is
   worse than an occasional abuse slip (the render cap + cost breaker catch volume abuse).
8. **`PREVIEW_MODE` guard:** refuse `PREVIEW_MODE=true` when `VERCEL_ENV=production` (assertion in
   `requireUser` or app startup).

## 2. Billing (Stripe)
- Stripe Checkout + Billing. Three plans (**launch prices — deliberately low to win early
  customers; designed to be raised later with existing users grandfathered**):
  | Plan | Price | Renders/mo | Seats | Quoting | Branding | Watermark |
  |---|---|---|---|---|---|---|
  | Free | $0 | 5 | 1 | no | no | yes |
  | Pro | $29/mo | 150 | 1 | yes | logo | no |
  | Team | $49/mo | 300 | 3 | yes | org branding | no |
  - Team's value is seats + branding (+ future integrations), not render volume. Extra seats become
    a per-seat add-on later — not in this build.
- Billing lives on `Organization` (owner-billed). Add fields: `stripe_customer_id`,
  `stripe_subscription_id`, `plan` (`free|pro|team`), `plan_status`, `current_period_end`,
  `render_limit`, `seats`.
- `/api/webhooks/stripe` — verify signature, sync subscription → plan/status/period.
- **Customer portal** link from `/settings` (Stripe-hosted) for card/plan management.
- Usage metering: derive current-period render count from `RenderJob` (or a small `UsageCounter`);
  enforced by §1.5. (Quoting/branding *gates* are wired here but their features arrive in Build 2/3 —
  free-tier still can't quote once Build 2 lands.)

## 3. Company profile & branding
- Activate `Organization`: on first login, create/attach an org owned by the user. Add
  `logo_url`, `phone`, `license_number`, `address`, `brand_color`, `website`.
- `/settings/company` (or a settings tab) to edit these + upload a logo to Blob. This branding
  feeds quotes, share pages, and watermarks in later builds.

## Data model (Prisma)
Plan/Stripe + branding fields on `Organization`; enum `PlanTier (free|pro|team)`; optional
`UsageCounter`. Activate the `User`↔`Organization` relation. **Migrations: keep `prisma db push`**
(the repo's current approach — no tracked-migrations baseline this build; revisit once there are
paying customers).

## Guardrails (from AGENTS.md)
Budget guard before paid calls · viability gate · always use `QueueAdapter` · scope every query to
user/org · keep the `after()` queue model (no fire-and-forget `setTimeout`) · `PREVIEW_MODE` off in
prod · update `RECENT_LOG.md`.

## Verification
- Stripe test mode: subscribe to Pro → `Organization.plan` reflects it; cancel → downgrades to free.
- Free-tier at cap → `/api/jobs` returns 402 → UI upgrade prompt.
- Rapid submits get rate-limited; scripted signup blocked by Turnstile; disposable-email signup
  rejected; off-topic prompt refused before any fal spend.
- **Global kill-switch**: set `GLOBAL_DAILY_COST_CAP_USD` to a tiny value (e.g. 0.10), submit
  renders across two accounts → the system refuses further paid work once the global cap is hit
  (not just one account), and refuses when Redis is made unreachable (fail-closed).
- Email confirmation ON: a fresh signup must confirm before it can render.
- Company profile saves + logo uploads.
- `npm run lint && npm run build` clean; end-to-end render still works on mobile.
