# AGENTS.md: Shared Global Instructions

This is the mandatory entrypoint for all agents. These instructions override all other general behaviors.

---

## 1. Pre-Flight Check (Every Prompt)
Before proposing any code, you MUST reference these three "Source of Truth" files:
1.  **`ARCHITECTURE_MAP.md`**: For route ownership, DB schema, worker pipeline, and service boundaries.
2.  **`RECENT_LOG.md`**: For the current sprint status and the last 3-5 major changes.
3.  **This File (`AGENTS.md`)**: For operational protocols.

---

## 2. The "Janitor" Protocol (Context Management)
To prevent "context drift" and performance degradation, you are responsible for document maintenance:
- **Update RECENT_LOG.md**: After every successful feature or major fix, append a concise summary (Pass #, files changed, new patterns).
- **Self-Archive**: If `RECENT_LOG.md` exceeds 300 lines or contains entries older than 14 days:
    1. Move older entries to `HISTORY_ARCHIVE.md`.
    2. Keep `RECENT_LOG.md` lean and focused on current tasks.
    3. Notify the user: "Cleaning up: Older logs moved to Archive."

---

## 3. Engineering Guardrails & Invariants
- **Budget Guard**: Before calling any paid API (Claude or fal.ai), verify `estimatedCost <= RENDER_BUDGET_CAP_USD`. If over cap, mark job `failed` with `failure_detail: "render_budget_exceeded"` and return without retry.
- **Viability Gate**: If Claude returns `request_viable === false` and `force_generate !== true`, complete the job with `placement_viable: false` and no `result_url`. Never call fal.ai in this case.
- **fal.ai Polling Cap**: Phase B polling is capped at 10 attempts (30s intervals ≈ 5 min coverage). On timeout, mark job `failed` with reason `TIMEOUT`.
- **Queue Abstraction**: Always use `QueueAdapter` — never import Vercel Queue directly. This preserves the BullMQ swap path.
- **Auth Scope**: Every Supabase/Prisma query must scope to the authenticated user (`userId`). Never return another user's jobs or renders.

---

## 4. Communication & Style
- **Iteration Tracking**: Every response must begin with a "Pass #" (e.g., "Pass 16").
- **Conciseness**: Use Markdown tables for UI proposals.
- **Conflict Warning**: If a user request violates the logic in `ARCHITECTURE_MAP.md`, flag the architectural conflict before writing code.

---

## 5. Quick Navigation Map
- **Upload / New Render UI**: `app/(app)/new/NewRenderClient.tsx` (route: /new)
- **Job Status Polling**: `app/(app)/jobs/[id]/JobStatusPoller.tsx` (route: /jobs/[id])
- **Render View**: `app/(app)/renders/[id]/RenderView.tsx` (route: /renders/[id])
- **Dashboard**: `app/(app)/dashboard/page.tsx` (route: /dashboard)
- **Jobs API**: `app/api/jobs/route.ts`
- **Webhooks / Queue**: `app/api/webhooks/queue/route.ts`
- **Worker (two-phase)**: `workers/render-job.ts`
- **Claude Vision**: `services/vision/analyze.ts`, `services/vision/prompt.ts`, `services/vision/schema.ts`
- **fal.ai Generation**: `services/generation/fal.ts`
- **Equipment Catalog**: `services/equipment/catalog.ts`, `services/equipment/descriptions.ts`
- **Queue Adapter**: `services/queue/adapter.ts`, `services/queue/enqueue.ts`
- **Observability**: `services/observability/metrics.ts`

## 6. File Editing Rules for Codex
Prefer targeted range reads (Select-Object -Skip X -First Y) over full-file reads.
Read the target function once, then patch in one operation where possible.
Avoid repeated blind string replacements; if first patch fails, verify exact text and line endings (CRLF/LF) before retry.
Prefer LSP symbol lookup when available; otherwise use rg for fast code search.
