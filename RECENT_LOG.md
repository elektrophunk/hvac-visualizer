# RECENT_LOG

## Current Sprint Status (as of 2026-07-02)
- **All three FABLE builds code complete** (Passes 17–19): Build 1 abuse/billing/branding, Build 2 quoting/PDF/watermark, Build 3 growth (slider, Good/Better/Best, leads, email, projects, analytics).
- Next: manual account setup — Stripe (test mode, prices $29/$49), Cloudflare Turnstile, Upstash Redis, **Resend** (verified sender + `RESEND_API_KEY`/`EMAIL_FROM`), Supabase "Confirm email" ON, all env vars into Vercel → full E2E (billing → render → proposal w/ tiers → customer accept → lead → emails) → deploy.
- Schema strategy LOCKED: `prisma db push` (no tracked migrations).
- ⚠️ **`DEV_UNLOCK_ALL_FEATURES=true` is set** (local + Vercel prod/preview, Pass 21) — all plan gates off for development. **Delete it everywhere at launch** (see TESTING.md). Cost guardrails remain active.
- Supabase "Confirm email" is ON but its built-in mailer is unreliable — turn it OFF in the dashboard for dev (Auth → Sign In / Providers → Email), back ON at launch. Stuck signups can be admin-confirmed via the service-role key.
- Env note: the Claude Code sandbox blocks Turbopack/PostCSS child-process spawn (0xc0000142) — run `npm run dev` outside the sandbox; `npm run build` is unaffected.

## Recent Major Changes

### 2026-07-04 - Pass 22
**Summary**
- **HVAC placement realism** (approved plan: `~/.claude/plans/nested-questing-moler.md`). Fixes renders placing equipment unrealistically (reported: mini-split heads coming back vertical/upside-down). Root cause: the pipeline never told the model the equipment's installation physics, and the `category` enum wasn't even passed to Claude. fal's Flux Kontext is instruction-only (no negative-prompt field), so realism lives in the instruction text.
- New **`services/vision/placement-rules.ts`**: `EQUIPMENT_PLACEMENT_RULES` keyed by the 9 categories — environment (indoor/outdoor/utility), mount surface, orientation, height, airflow, clearances, and explicit `forbidden` failure modes. `renderPlacementManual()` (all rules → system prompt), `placementRuleLine(cat)` (one rule → user message), `placementConstraintSuffix(cat)` (deterministic physics line → appended to the fal instruction).
- **Two-layer enforcement**: (1) Claude sees the rulebook in `VISION_SYSTEM_PROMPT` + the selected category's rule inlined in the user message, so its `enriched_prompt` is scene-aware AND rule-compliant; it also now sets `request_viable=false` when the equipment's environment can't match the photo (outdoor unit in an indoor shot). (2) The worker appends `placementConstraintSuffix(category)` to the enriched prompt before fal as a non-negotiable backstop.
- **Every entry path covered**: quick-picks carry `equipment_id` (→ real category); custom typed prompts get `detected_category` (Claude classifies the requested equipment), so the worker uses `equipment.category ?? detected_category` for the suffix. Analysis schema bumped **v2.1 → v2.2** (`detected_category` required).
- Appearance (`prompt_description`) vs. physics (rulebook) stay cleanly separated — rules live in code, composed at runtime, no re-seed. `guidance_scale` noted as the next tuning knob if drift persists.

**Code touched**
- services/vision/placement-rules.ts (new); services/vision/{prompt,schema,analyze}.ts; types/analysis.ts; workers/render-job.ts; ARCHITECTURE_MAP.md

**Verification**
- `npm run lint` 0 errors; `npm run build` clean.
- Unit (tsx): manual covers all 9 categories; every `placementConstraintSuffix` carries a forbidden-orientation line; a `schema_version:"2.2"` + `detected_category` payload validates, while `"2.1"` and missing-`detected_category` payloads are rejected (guards the bump).
- **Needs live eyeball** (deployed): mini-split renders horizontal/high/right-side up via both quick-pick and free-typed prompt; outdoor condenser sits upright outdoors; ceiling cassette flush; outdoor-unit-on-indoor-photo trips the not-viable card.

### 2026-07-02 - Pass 19
**Summary**
- FABLE_BUILD_3 complete (approved plan: `~/.claude/plans/nested-questing-moler.md`). Locked decisions: `QuoteOption` table for Good/Better/Best; analytics as stat cards on `/dashboard`; dedicated `/leads` page; proposal-viewed email on **first view only**.
- **Before/after slider**: `components/BeforeAfterSlider.tsx` (pointer-events drag + keyboard, touch-friendly, clip-path) replaces the static side-by-side as the hero on `/renders/[id]`, `/share/[token]`, and `/proposal/[token]`.
- **Good/Better/Best**: `QuoteOption` model (cascade on quote delete; own line items + totals computed with quote-level `tax_rate`; `sort_order`) + `Quote.accepted_option_id`. Options are additive — 0 options = single estimate, 1–4 tiers otherwise; quote totals mirror tier 1 until acceptance copies the chosen tier's totals. `POST/PATCH /api/quotes` validate tier renders (owner + result) and replace options wholesale; respond route requires an `option_id` when tiers exist and flips `quote_accepted` on the tier's render. QuoteForm gained a tiers toggle with per-tier render picker (recent-renders thumbnails) + live totals; customer page shows side-by-side tier cards with per-tier accept; PDF renders per-tier blocks; `/quotes/[id]` shows tier chips + accepted tier.
- **Lead capture**: `Lead` model + `LeadStatus`. Public `POST /api/leads` is token-gated (render or quote share token resolved server-side — client never sends IDs), IP-rate-limited (new `leads` scope: 3/min, 10/hr), honeypot-protected (fake 201, nothing stored). `LeadForm` on both public pages; `/leads` page with tel:/mailto: links, source links, and new→contacted→closed status buttons (`PATCH /api/leads/[id]`, org-scoped via `updateMany` count). Nav link added.
- **Email (Resend)**: `services/email/{resend,templates,notify}.ts` — `sendEmail()` no-ops with a warning when `RESEND_API_KEY` unset and never throws. Wired: render-complete (both finalize paths, after the transaction), proposal-viewed (first view only, inside `after()` with the view-counter increment), new-lead (via `after()`, to org owner), and the deferred weekly cost-report email (cron TODO resolved; alert flag in subject).
- **Projects**: `GET/POST /api/projects` (org-scoped); `/new` gained an optional project picker with inline create; `/api/jobs` validates + stores `project_id`; dashboard filters by project chips and shows project names on rows.
- **Dashboard analytics strip**: four stat cards — renders used vs limit (reuses `getPeriodRenderCount`), proposals sent/viewed/accepted, acceptance rate, leads (+new) — all queries `.catch`-guarded, linking to `/settings`, `/proposals`, `/leads`.
- Middleware: `/leads`, `/api/projects` protected; `/api/leads` deliberately public (POST is token-gated; PATCH enforces auth in-route).

**Code touched**
- prisma/schema.prisma (Lead, LeadStatus, QuoteOption, Quote.accepted_option_id; db push applied)
- services/email/{resend,templates,notify}.ts, components/{BeforeAfterSlider,LeadForm}.tsx (new); services/pdf/{proposal-document.tsx,render-proposal.ts}; lib/{quote-totals,ratelimit}.ts; types/quotes.ts
- app/api/leads/{route.ts,[id]/route.ts}, app/api/projects/route.ts (new); app/api/quotes/{route.ts,[id]/route.ts,[id]/pdf/route.ts}; app/api/proposal/[token]/{respond,pdf}/route.ts; app/api/jobs/{route.ts,[id]/route.ts}; app/api/cron/cost-report/route.ts; workers/render-job.ts
- app/(app)/leads/{page,LeadRow}.tsx (new); app/(app)/dashboard/page.tsx (stats + project filter); app/(app)/new/{page,NewRenderClient}.tsx; app/(app)/quotes/{QuoteForm.tsx,new/page.tsx,[id]/page.tsx,[id]/QuoteDetailClient.tsx}; app/(app)/renders/[id]/RenderView.tsx; app/(app)/layout.tsx; app/share/[token]/page.tsx; app/proposal/[token]/{page,ProposalActions}.tsx; proxy.ts; .env.example; ARCHITECTURE_MAP.md; package.json (+resend)

**Verification**
- `npm run lint` — 0 errors; `npm run build` — clean (all routes incl. `/leads`, `/api/leads`, `/api/projects`).
- Unit script (tsx): per-tier totals with 8.25% quote-level tax exact (3464.00 / 6224.38); options zod accepts 2 tiers, rejects 5 tiers and empty-line-item tiers; line-item bounds still enforced.
- Dev smoke (unsandboxed): bogus-token lead POST → 404 with clear message; missing contact info → 400 validation message; honeypot POST → fake 201; unauth `PATCH /api/leads/[id]` → 401; `/leads` + `/api/projects` + `/dashboard` → 307 logged-out; bogus `/share` + `/proposal` tokens → 404; root 200.
- **Needs live keys / human**: Resend sends (account + verified sender), slider drag feel on a phone, GBB accept E2E with a Pro org and real renders, watermark + render-complete email on a real render.

### 2026-07-02 - Pass 18
**Summary**
- FABLE_BUILD_2 complete (approved plan: `~/.claude/plans/nested-questing-moler.md`). Locked decisions: @react-pdf/renderer; new public `/proposal/[token]` (render `/share` untouched); new `/proposals` manage page; corner-badge watermark.
- **Quote model**: `Quote` + `QuoteStatus` enum (draft|sent|accepted|declined) — references `render_id` only; structured `line_items` JSON for future auto-fill; `Decimal` money columns; own `share_token` (created with the quote, TTL `QUOTE_SHARE_TTL_SECONDS` default 90d, refreshed on edit); `viewed_count`, `responded_at`. Totals always recomputed server-side in `lib/quote-totals.ts` (per-line cent rounding).
- **APIs**: `POST /api/quotes` (plan-gated via `features.quoting` — free → 402 upsell payload; verifies render ownership + non-empty result), `PATCH /api/quotes/[id]` (edit/recompute/mark-sent; 409 once responded), `POST /api/proposal/[token]/respond` (public, idempotent accept/decline → `Quote.status` + `Render.quote_accepted` in a transaction), `GET /api/quotes/[id]/pdf` (auth, attachment) + `GET /api/proposal/[token]/pdf` (public, inline) sharing one React-PDF document.
- **Branded PDF** (`services/pdf/`): letter one-pager — org logo/name/phone/license/address/website, brand-color rules, result image, before/after pair, line-item table, subtotal/tax/total, notes, disclaimer footer. Needed an `as ReactElement<DocumentProps>` cast for `renderToBuffer`.
- **UI**: shared `QuoteForm` (dynamic line items, live totals), `/quotes/new?render=` (free plan sees upsell card), `/quotes/[id]` detail (status chip, copy link, PDF, mark sent; read-only after response), `/proposals` list, nav link, "Create proposal" button on RenderView. Public `/proposal/[token]`: org-branded header, estimate table, notes, Accept/Decline with confirm step + PDF link, view counter, `noindex`, custom not-found.
- **Watermark**: `services/images/watermark.ts` — sharp SVG corner badge ("Made with HVAC Visualizer", scales with width), gated by org plan `features.watermark`, non-fatal wrapper; wired into both finalize paths (`workers/render-job.ts` poll-COMPLETED and the eager finalize in `app/api/jobs/[id]/route.ts` — job lookup moved above upload there to know the owner).
- **Middleware**: `/proposals`, `/quotes`, `/api/quotes`, `/api/billing`, `/api/org` added to protected prefixes; `/proposal`+`/api/proposal` intentionally public (token-scoped).

**Code touched**
- prisma/schema.prisma (Quote/QuoteStatus; db push applied); types/quotes.ts, lib/quote-totals.ts, services/images/watermark.ts, services/pdf/{proposal-document.tsx,render-proposal.ts} (new)
- app/api/quotes/{route.ts,[id]/route.ts,[id]/pdf/route.ts}, app/api/proposal/[token]/{respond,pdf}/route.ts (new)
- app/(app)/quotes/{QuoteForm.tsx,new/page.tsx,[id]/page.tsx,[id]/QuoteDetailClient.tsx}, app/(app)/proposals/page.tsx, app/proposal/[token]/{page,ProposalActions,not-found}.tsx (new)
- app/(app)/layout.tsx (nav), app/(app)/renders/[id]/RenderView.tsx (button), workers/render-job.ts, app/api/jobs/[id]/route.ts, proxy.ts, .env.example, ARCHITECTURE_MAP.md, package.json (+@react-pdf/renderer)

**Verification**
- `npm run lint` — 0 errors; `npm run build` — clean, all new routes compile.
- Unit script (tsx): totals 2×$1200.50 + 1×$99.99 @ 8.25% → 2500.99/206.33/2707.32 PASS; watermark composites onto 1200×800 JPEG (output changed, format/dimensions preserved) PASS; PDF renders `%PDF-` (9.9 KB) PASS.
- Dev-server smoke (unsandboxed — see env note): bogus `/proposal/*` page/PDF/respond → 404; `/proposals` + `/quotes/new` + `POST /api/quotes` → 307 logged-out; `/share/[token]` unaffected.
- **Still needs live keys** (after Pass 17 manual setup): Pro-plan E2E — create proposal → PDF branding → customer Accept flips status + `quote_accepted`; watermark visually confirmed on a real free-tier render.

### 2026-07-02 - Pass 17
**Summary**
- FABLE_BUILD_1 complete (approved plan: `~/.claude/plans/nested-questing-moler.md`). Locked decisions: pricing Free $0·5 renders / Pro $29·150 / Team $49·300+3 seats (launch-low, grandfather later); moderation via extended vision call; seats field only (no invite flow); keep `db push`.
- **Abuse layer**: server-side signup route (`/api/auth/signup`) with Cloudflare Turnstile + disposable-email blocklist (`disposable-email-domains`), confirm-email interstitial with resend; Upstash sliding-window rate limits on `/api/jobs` + `/api/uploads` (per-user + per-IP, env-tunable, no-op with warning when unset); `POST /api/jobs` gate chain: rate limit (429) → org paused (403) → global daily cost cap (503) → plan render cap (**402** + upsell payload) → per-org daily spend ceiling with **auto-pause** (`Organization.paused_at`) → Turnstile for free plan → keyword prescreen; content moderation via vision schema **v2.1** `content_flag` (`ok|nsfw_or_abusive|off_domain`) — worker fails the job `MODERATION_BLOCKED` (new enum value) before any fal call; `PREVIEW_MODE=true` now throws when `VERCEL_ENV=production`.
- **Billing (Stripe)**: `Organization` activated as the owner-billed plan holder (lazy creation slug `org-<user.id>`, backfills existing accounts); `PlanTier` enum + billing/branding/abuse fields on `Organization`; plan truth in `services/billing/plans.ts` (limits/ceilings/feature gates env-tunable; quoting/branding/watermark gates wired for Builds 2–3); `/api/billing/checkout` + `/api/billing/portal`; signature-verified `/api/webhooks/stripe` syncs plan/status/period/limits (period dates read from the **subscription item** — Stripe API dahlia); Settings gains a Billing card (plan, renders used/limit, upgrade buttons or portal link).
- **Branding**: `/settings/company` (name, phone, license, address, website, brand color, logo upload → sharp 512px PNG → Blob, old blob deleted); `PATCH /api/org` (owner-only, zod-validated); `POST /api/org/logo`.
- **UX**: `/new` renders Turnstile for free-plan users, shows an upgrade card on 402 and a slow-down message on 429; "Generate anyway" on the job page got the same CAPTCHA handling; poller shows a friendly `MODERATION_BLOCKED` message.

**Code touched**
- prisma/schema.prisma (db push applied); services/billing/{plans,stripe}.ts (new); lib/{usage,ratelimit,turnstile,moderation,disposable-email}.ts (new); lib/auth.ts; types/{analysis,jobs}.ts; types/disposable-email-domains.d.ts (new)
- app/api/auth/signup/route.ts (new); app/api/billing/{checkout,portal}/route.ts (new); app/api/webhooks/stripe/route.ts (new); app/api/org/{route,logo/route}.ts (new); app/api/{jobs,uploads}/route.ts
- services/vision/{prompt,schema}.ts (v2.1); workers/render-job.ts (moderation gate); services/storage/blob.ts (orgLogoPath)
- app/(auth)/signup/page.tsx; app/(app)/new/{page,NewRenderClient}.tsx; app/(app)/jobs/[id]/{page,JobStatusPoller}.tsx; app/(app)/settings/{page,SettingsClient}.tsx; app/(app)/settings/company/{page,CompanyClient}.tsx (new)
- .env.example; ARCHITECTURE_MAP.md; package.json (+stripe, @upstash/ratelimit, @upstash/redis, @marsidev/react-turnstile, disposable-email-domains)

**Verification**
- `npm run lint` — 0 errors (10 warnings, pre-existing `<img>`/unused-var pattern).
- `npm run build` — clean; all new routes compile (`/api/auth/signup`, `/api/billing/*`, `/api/webhooks/stripe`, `/api/org`, `/api/org/logo`, `/settings/company`).
- `prisma db push` — applied against Supabase (new columns defaulted/nullable; `stripe_customer_id` unique constraint safe on the empty/dormant table).
- **Manual steps still required** (not code): ① Supabase dashboard → Auth → "Confirm email" ON; ② create Stripe products/prices (Pro $29, Team $49) + webhook endpoint (`checkout.session.completed`, `customer.subscription.*`) and set `STRIPE_*` env vars; ③ create Cloudflare Turnstile site + Upstash Redis DB and set their env vars in Vercel; ④ Stripe test-mode E2E (subscribe → plan syncs; cancel → downgrade) once keys exist.

### 2026-07-01 - Pass 16
**Summary**
- Finished the app to MVP-complete + mobile-ready (approved plan: `~/.claude/plans/i-have-loaded-you-wobbly-newt.md`).
- **Pipeline reliability on Vercel**: queue adapter's delayed sends now use `after()` from `next/server` (Vercel `waitUntil`) instead of fire-and-forget `setTimeout` that dies when the function freezes; `POST /api/jobs` enqueues in the background and returns 201 immediately (was blocking ~20s on all of Phase A); queue webhook fails closed in production when `VERCEL_QUEUE_TOKEN` is unset; watchdog cron extended to recover stale `awaiting_fal_result` and never-started `queued` jobs; webhook `maxDuration` 300, `jobs/[id]` 60 in vercel.json.
- **Equipment catalog wired**: `prisma/seed.ts` upserts 9 catalog rows from `EQUIPMENT_DEFAULT_PROMPTS`; `/new` builds quick-picks from the DB (static fallback) and sends `equipment_id`; worker already enriched prompts via `equipment.prompt_description`.
- **Dead-ends fixed**: new public `/share/[token]` page (before/after, view counter, noindex, expired-link 404) — the Share button previously 404'd; new `/settings` page with type-DELETE confirm dialog wired to `DELETE /api/account/data`; "Generate anyway" now works (job page passes source/prompt/equipment to the poller) and surfaces errors; `viability_reason` is read from the analysis JSON instead of hardcoded null; not-viable jobs no longer create broken empty `Render` rows (RenderView guards legacy ones); root `error.tsx`/`not-found.tsx`/`(app)/loading.tsx`; login honors the proxy's `redirectTo`.
- **Mobile/PWA**: "Take photo" camera capture input (`capture="environment"`) alongside library upload; viewport + manifest + generated icons (favicon, apple-icon, 192/512); sticky mobile-safe nav with Settings link; 16px inputs on mobile (no iOS zoom); full-width action rows and ≥40px touch targets.
- Housekeeping: `sharp` promoted to a direct dependency (was transitively supplied by next — Vercel build risk); `eslint-config-next` 16.x + flat-config rewrite (`next lint` is gone; script is `eslint .`); `tsx` + `db:seed` + `postinstall: prisma generate`; removed unused Radix avatar/select/toast deps and dead Dialog/Badge imports; render results stored as `final.jpg` (was `.png` with jpeg content); documented `VERCEL_QUEUE_URL`/`PREVIEW_MODE` in `.env.example`.

**Code touched**
- services/queue/{vercel-queue-adapter,adapter,enqueue}.ts; app/api/jobs/route.ts; app/api/jobs/[id]/route.ts; app/api/webhooks/queue/route.ts; app/api/cron/watchdog/route.ts; vercel.json
- prisma/seed.ts (new); app/(app)/new/{page,NewRenderClient}.tsx; workers/render-job.ts
- app/share/[token]/{page,not-found}.tsx (new); app/(app)/settings/{page,SettingsClient}.tsx (new); app/(app)/jobs/[id]/{page,JobStatusPoller}.tsx; app/(app)/renders/[id]/RenderView.tsx; app/(app)/dashboard/page.tsx; app/(app)/layout.tsx; app/(auth)/login/page.tsx; proxy.ts
- app/{layout,manifest,error,not-found}.tsx; app/(app)/loading.tsx; app/{icon,apple-icon}.png; public/icons/*; components/ui/input.tsx; eslint.config.mjs; package.json; .env.example; services/storage/blob.ts

**Verification**
- `npm run lint` — 0 errors (9 pre-existing `<img>`/unused-var warnings).
- `npm run build` — clean; all routes compile including new `/settings`, `/share/[token]`, `/manifest.webmanifest`, icons.
- `prisma db push` + `db:seed` **not run**: Supabase project is gone (see blocker above). End-to-end phone test pending Vercel deploy after DB restore.

*(Passes 14–15 from 2026-05-29 moved to `HISTORY_ARCHIVE.md` — Janitor protocol, >14 days old.)*
