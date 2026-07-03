# ARCHITECTURE_MAP.md

This file is the master navigation and system design map for HVAC Renovation Visualizer.

## 1) System Overview & Data Flow
**Purpose:** Contractor-facing sales tool. Upload a site photo → describe the desired HVAC equipment in natural language → receive a photorealistic rendered image to attach to a customer quote.

### Pipeline Summary
```
User uploads photo → Vercel Blob (source image)
  → POST /api/jobs → Prisma (RenderJob created) → Vercel Queue (phase: "analyze")
  → Worker Phase A: Claude Vision (scene analysis + prompt enrichment)
      → [not viable + !force_generate] → completed (placement_viable: false), viability UI
      → [viable or force_generate]     → fal.ai queue submit → awaiting_fal_result
  → Worker Phase B (30s poll, max 10 attempts):
      → COMPLETED → Vercel Blob (result image) → Prisma (job + Render updated) → completed
      → FAILED    → failed (FAL_API_ERROR, retry up to max_attempts)
      → timeout   → failed (TIMEOUT)
```

### Services & Integrations
- **Claude API** (Anthropic): Vision + structured JSON output — scene analysis, viability check, prompt enrichment. Schema version 2.0.
- **fal.ai** (Flux Pro Kontext Max): AI image editing — inserts equipment into the source photo. Endpoint: `fal-ai/flux-pro/kontext/max`.
- **Vercel Blob**: Stores source images, result images, and `analysis_json_url` artifacts.
- **Supabase (PostgreSQL) + Prisma**: Primary database. RLS disabled at DB layer; auth scoping is enforced in application code.
- **Vercel Queue**: Job queue for async worker dispatch. Abstracted behind `QueueAdapter` for BullMQ swap path.
- **Supabase Auth**: Email/password auth (v0.1). Every query scoped to `user_id`.

---

## 2) Route & UI Ownership

| Route | Entry File | Key UI Components | Primary Server Actions / APIs |
|---|---|---|---|
| `/new` | `app/(app)/new/page.tsx` | `NewRenderClient.tsx` | `POST /api/jobs` |
| `/jobs/[id]` | `app/(app)/jobs/[id]/page.tsx` | `JobStatusPoller.tsx` | `GET /api/jobs/[id]` |
| `/renders/[id]` | `app/(app)/renders/[id]/page.tsx` | `RenderView.tsx` | — (SSR fetch) |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | — | — (SSR fetch) |
| `/api/jobs` | `app/api/jobs/route.ts` | — | Abuse/billing gates → creates RenderJob, enqueues Phase A |
| `/api/jobs/[id]` | `app/api/jobs/[id]/route.ts` | — | Returns job status + result_url |
| `/api/webhooks/queue` | `app/api/webhooks/queue/route.ts` | — | Receives queue callbacks → worker |
| `/api/auth/signup` | `app/api/auth/signup/route.ts` | — | Server-side signup: Turnstile + disposable-email check → Supabase signUp |
| `/api/billing/checkout` | `app/api/billing/checkout/route.ts` | — | Stripe Checkout session for pro/team |
| `/api/billing/portal` | `app/api/billing/portal/route.ts` | — | Stripe customer-portal session |
| `/api/webhooks/stripe` | `app/api/webhooks/stripe/route.ts` | — | Signature-verified subscription sync → `Organization.plan` |
| `/api/org` | `app/api/org/route.ts` | — | PATCH company branding (owner only) |
| `/api/org/logo` | `app/api/org/logo/route.ts` | — | Logo upload → sharp resize → Blob |
| `/settings` | `app/(app)/settings/page.tsx` | `SettingsClient.tsx` | Billing card (plan/usage/upgrade/portal), data deletion |
| `/settings/company` | `app/(app)/settings/company/page.tsx` | `CompanyClient.tsx` | Company profile + logo (`PATCH /api/org`) |
| `/quotes/new?render=` | `app/(app)/quotes/new/page.tsx` | `QuoteForm.tsx` | Create proposal from a render (plan-gated, free → upsell) |
| `/quotes/[id]` | `app/(app)/quotes/[id]/page.tsx` | `QuoteDetailClient.tsx` | Edit draft, copy link, PDF, mark sent |
| `/proposals` | `app/(app)/proposals/page.tsx` | — | Proposal list (status, total, views) |
| `/proposal/[token]` | `app/proposal/[token]/page.tsx` | `ProposalActions.tsx` | **Public** customer proposal: branding, estimate, Accept/Decline, PDF |
| `/api/quotes` | `app/api/quotes/route.ts` | — | POST create (plan gate, server-side totals, share token) |
| `/api/quotes/[id]` | `app/api/quotes/[id]/route.ts` | — | PATCH edit/mark-sent (blocked once responded) |
| `/api/quotes/[id]/pdf` | `app/api/quotes/[id]/pdf/route.ts` | — | Branded PDF (auth, @react-pdf/renderer) |
| `/api/proposal/[token]/pdf` | `app/api/proposal/[token]/pdf/route.ts` | — | **Public** PDF (token-scoped) |
| `/api/proposal/[token]/respond` | `app/api/proposal/[token]/respond/route.ts` | — | **Public** accept (with optional `option_id` tier pick) / decline |
| `/leads` | `app/(app)/leads/page.tsx` | `LeadRow.tsx` | Org-scoped lead list with status workflow |
| `/api/leads` | `app/api/leads/route.ts` | — | **Public** POST (token-gated, rate-limited, honeypot) → Lead + contractor email |
| `/api/leads/[id]` | `app/api/leads/[id]/route.ts` | — | PATCH status (auth, org-scoped) |
| `/api/projects` | `app/api/projects/route.ts` | — | GET list / POST create (org-scoped) |

---

## 3) Core Database Schema

### Enums
- `JobStatus`: `queued`, `processing`, `awaiting_fal_result`, `completed`, `failed`
- `FailureReason`: `CLAUDE_API_ERROR`, `CLAUDE_JSON_INVALID`, `FAL_API_ERROR`, `STORAGE_ERROR`, `TIMEOUT`, `MODERATION_BLOCKED`, `UNKNOWN`
- `PlanTier`: `free`, `pro`, `team`
- `QuoteStatus`: `draft`, `sent`, `accepted`, `declined`
- `LeadStatus`: `new`, `contacted`, `closed`
- `EquipmentCategory`: `mini_split_head`, `mini_split_condenser`, `central_air_handler`, `furnace`, `heat_pump_condenser`, `boiler`, `ductless_cassette`, `ventilator`, `other`

### Primary Tables
- **`User`**: Linked to Supabase auth via `supabase_uid`. Owns `RenderJob[]` and `Render[]`. Always belongs to an org (lazily created on first authenticated request, slug `org-<user.id>`).
- **`Organization`**: Owner-billed org (activated in Build 1). Billing: `plan (PlanTier)`, `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_start/end`, `render_limit`, `seats`. Branding: `logo_url`, `phone`, `license_number`, `address`, `brand_color`, `website`. Abuse: `paused_at`, `pause_reason`. Plan truth lives in `services/billing/plans.ts` (env-tunable limits/ceilings/feature gates).
- **`Project`**: Optional project grouping for jobs. Fields: `name`, `org_id`, `owner_id`.
- **`Equipment`**: Catalog of HVAC equipment. Key fields: `name`, `slug`, `category`, `thumbnail_url`, `prompt_description` (used for fal prompt enrichment), `metadata`.
- **`RenderJob`**: Core job record. Key fields: `user_prompt`, `force_generate`, `source_image_url`, `status`, `fal_request_id`, `placement_viable`, `result_url`, `analysis_json_url`, `cost_usd`, `fal_cost_usd`, latency columns.
- **`Render`**: Final output record. Created on job completion. Fields: `source_image_url`, `result_image_url`, `analysis_json_url`, `share_token`, `realism_rating`, `usefulness_rating`, `quote_accepted`.
- **`Quote`**: Proposal built from a render (Pro/Team only — `features.quoting`). `render_id`, `user_id`, `org_id`, customer fields, structured `line_items` JSON (`[{description, qty, unit_price}]` — future auto-fill target), `subtotal`/`tax_rate`/`tax`/`total` (always recomputed server-side in `lib/quote-totals.ts`), `status (QuoteStatus)`, own `share_token` + `share_expires_at` (`QUOTE_SHARE_TTL_SECONDS`, refreshed on edit), `viewed_count`, `responded_at`, `accepted_option_id` (Good/Better/Best pick).
- **`QuoteOption`**: Good/Better/Best tier on a quote (0 options = plain single estimate; 1–4 tiers otherwise). `quote_id` (cascade delete), `label`, optional `render_id`, own `line_items` + computed totals (quote-level `tax_rate`), `sort_order`. Quote-level totals mirror the first tier until the customer accepts one; accept copies the chosen tier's totals onto the quote. PATCH replaces options wholesale.
- **`Lead`**: Inbound contact request from a public share/proposal page. `org_id` (resolved server-side from the share token — never client-supplied), optional `render_id`/`quote_id` source, `name`/`phone`/`email`/`message`, `status (LeadStatus)`.

---

## 4) Worker Pipeline Detail

### Submit-time gates (`POST /api/jobs`, before any job exists; skipped in preview mode)
rate limit (429) → org paused (403) → global daily cost cap (503) → plan render cap (**402** + upsell payload) → per-org daily spend ceiling (auto-pause, 403) → Turnstile for free plan (403) → keyword prescreen (400)

### Phase A — `"analyze"` (initial queue message)
1. Fetch source image as Buffer (for Claude base64 input)
2. **Budget guard**: `CLAUDE_ESTIMATED_COST_USD + falCostUsd() > RENDER_BUDGET_CAP_USD` → fail immediately, no retry
3. Claude vision: `analyzeImage(buffer, mimeType, user_prompt, equipment.prompt_description)` → `{ scene, request_viable, viability_reason, enriched_prompt, content_flag, schema_version: "2.1" }`
4. Store analysis JSON to Vercel Blob → `analysis_json_url`
5. **Moderation gate**: if `content_flag !== "ok"` → `status = failed`, `MODERATION_BLOCKED`, `poison_message = true`, return (no fal call, no retry)
6. **Viability gate**: if `request_viable === false && !force_generate` → `status = completed, placement_viable = false`, return (no fal call)
7. Submit to fal: `submitGenerationJob(source_image_url, enriched_prompt)` → `fal_request_id`
8. Update job: `status = awaiting_fal_result`, persist `fal_request_id`
9. Re-enqueue `phase: "poll"` with 30s delay

### Phase B — `"poll"` (polling message)
1. `checkGenerationStatus(fal_request_id)` → `IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED`
2. Not done → re-enqueue poll with 30s delay, increment `pollAttempt` (max 10)
3. FAILED → `failed` with `FAL_API_ERROR`, retry if `attempt_count < max_attempts`
4. COMPLETED → `fetchGenerationResult()` → **free-tier watermark** (`services/images/watermark.ts`, non-fatal, gated by org plan `features.watermark`; also applied in the eager finalize in `app/api/jobs/[id]/route.ts`) → upload to Vercel Blob → update `result_url`, create `Render` record, `status = completed`
5. Poll timeout (`pollAttempt >= 10`) → `failed` with `TIMEOUT`

---

## 5) Task → File Playbook

| Goal | Files to Modify |
|---|---|
| **Change upload/prompt UI** | `app/(app)/new/NewRenderClient.tsx` |
| **Change job submission logic** | `app/api/jobs/route.ts` |
| **Modify Claude prompt or schema** | `services/vision/prompt.ts`, `services/vision/schema.ts` |
| **Modify Claude analysis call** | `services/vision/analyze.ts` |
| **Modify fal.ai generation** | `services/generation/fal.ts` |
| **Change worker pipeline** | `workers/render-job.ts` |
| **Change job status polling UI** | `app/(app)/jobs/[id]/JobStatusPoller.tsx` |
| **Change render result view** | `app/(app)/renders/[id]/RenderView.tsx` |
| **Change queue enqueue logic** | `services/queue/enqueue.ts`, `services/queue/adapter.ts` |
| **Add/edit equipment catalog** | `services/equipment/catalog.ts`, `services/equipment/descriptions.ts` |
| **Change cost tracking / metrics** | `services/observability/metrics.ts` |
| **Change plans / pricing / limits** | `services/billing/plans.ts` (+ env overrides) |
| **Change billing flows** | `app/api/billing/{checkout,portal}/route.ts`, `app/api/webhooks/stripe/route.ts` |
| **Change abuse gates** | `app/api/jobs/route.ts`, `lib/{ratelimit,turnstile,moderation,usage}.ts` |
| **Change company branding** | `app/(app)/settings/company/*`, `app/api/org/*` |
| **Change quotes/proposals** | `app/api/quotes/*`, `app/api/proposal/*`, `app/(app)/quotes/*`, `app/(app)/proposals/*`, `app/proposal/[token]/*`, `lib/quote-totals.ts` |
| **Change proposal PDF** | `services/pdf/{proposal-document.tsx,render-proposal.ts}` |
| **Change watermark** | `services/images/watermark.ts` (+ both finalize paths) |
| **Change transactional email** | `services/email/{resend,templates,notify}.ts` (+ call sites: worker, jobs/[id], proposal page, leads route, cost-report cron) |
| **Change before/after slider** | `components/BeforeAfterSlider.tsx` |
| **Change lead capture** | `app/api/leads/*`, `components/LeadForm.tsx`, `app/(app)/leads/*` |
| **Change projects** | `app/api/projects/route.ts`, `/new` picker, dashboard filter |
| **Change dashboard analytics** | `app/(app)/dashboard/page.tsx` (stat queries) |
| **DB schema changes** | `prisma/schema.prisma` + `npm run db:push` (**locked approach** — no tracked migrations; revisit before Build 2) |

---

## 6) Critical Rules
- **Budget Guard**: Check `estimatedCost <= RENDER_BUDGET_CAP_USD` before any paid API call. Fail immediately (no retry) if over cap.
- **Viability Gate**: `request_viable === false && !force_generate` → complete without fal.ai. Show viability UI.
- **Queue Abstraction**: Always use `QueueAdapter` — never call Vercel Queue directly.
- **Auth Scope**: Scope every query to `user_id`. Never expose another user's data.
- **Janitor Protocol**: Update `RECENT_LOG.md` after major changes; move old entries to `HISTORY_ARCHIVE.md` when over 300 lines.

---

## 7) Hard Metrics (from locked decisions)
| Metric | Target |
|---|---|
| Preview latency | < 12s |
| Final render latency | < 30s |
| Cost per render | < $0.40 |
| Realism score | ≥ 4/5 |
| Usefulness score | ≥ 4/5 |
| Failure rate | < 5% |
