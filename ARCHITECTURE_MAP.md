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
| `/api/jobs` | `app/api/jobs/route.ts` | — | Creates RenderJob, enqueues Phase A |
| `/api/jobs/[id]` | `app/api/jobs/[id]/route.ts` | — | Returns job status + result_url |
| `/api/webhooks/queue` | `app/api/webhooks/queue/route.ts` | — | Receives queue callbacks → worker |

---

## 3) Core Database Schema

### Enums
- `JobStatus`: `queued`, `processing`, `awaiting_fal_result`, `completed`, `failed`
- `FailureReason`: `CLAUDE_API_ERROR`, `CLAUDE_JSON_INVALID`, `FAL_API_ERROR`, `STORAGE_ERROR`, `TIMEOUT`, `UNKNOWN`
- `EquipmentCategory`: `mini_split_head`, `mini_split_condenser`, `central_air_handler`, `furnace`, `heat_pump_condenser`, `boiler`, `ductless_cassette`, `ventilator`, `other`

### Primary Tables
- **`User`**: Linked to Supabase auth via `supabase_uid`. Owns `RenderJob[]` and `Render[]`.
- **`Organization`**: Optional org grouping. Fields: `name`, `slug`.
- **`Project`**: Optional project grouping for jobs. Fields: `name`, `org_id`, `owner_id`.
- **`Equipment`**: Catalog of HVAC equipment. Key fields: `name`, `slug`, `category`, `thumbnail_url`, `prompt_description` (used for fal prompt enrichment), `metadata`.
- **`RenderJob`**: Core job record. Key fields: `user_prompt`, `force_generate`, `source_image_url`, `status`, `fal_request_id`, `placement_viable`, `result_url`, `analysis_json_url`, `cost_usd`, `fal_cost_usd`, latency columns.
- **`Render`**: Final output record. Created on job completion. Fields: `source_image_url`, `result_image_url`, `analysis_json_url`, `share_token`, `realism_rating`, `usefulness_rating`, `quote_accepted`.

---

## 4) Worker Pipeline Detail

### Phase A — `"analyze"` (initial queue message)
1. Fetch source image as Buffer (for Claude base64 input)
2. **Budget guard**: `CLAUDE_ESTIMATED_COST_USD + falCostUsd() > RENDER_BUDGET_CAP_USD` → fail immediately, no retry
3. Claude vision: `analyzeImage(buffer, mimeType, user_prompt, equipment.prompt_description)` → `{ scene, request_viable, viability_reason, enriched_prompt, schema_version: "2.0" }`
4. Store analysis JSON to Vercel Blob → `analysis_json_url`
5. **Viability gate**: if `request_viable === false && !force_generate` → `status = completed, placement_viable = false`, return (no fal call)
6. Submit to fal: `submitGenerationJob(source_image_url, enriched_prompt)` → `fal_request_id`
7. Update job: `status = awaiting_fal_result`, persist `fal_request_id`
8. Re-enqueue `phase: "poll"` with 30s delay

### Phase B — `"poll"` (polling message)
1. `checkGenerationStatus(fal_request_id)` → `IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED`
2. Not done → re-enqueue poll with 30s delay, increment `pollAttempt` (max 10)
3. FAILED → `failed` with `FAL_API_ERROR`, retry if `attempt_count < max_attempts`
4. COMPLETED → `fetchGenerationResult()` → upload to Vercel Blob → update `result_url`, create `Render` record, `status = completed`
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
| **DB schema changes** | `prisma/schema.prisma` + migration |

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
