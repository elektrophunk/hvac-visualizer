# RECENT_LOG

## Current Sprint Status (as of 2026-07-01)
- Focus: MVP-complete + mobile-ready + Vercel deploy prep.
- Supabase blocker RESOLVED: project was paused (not deleted); after restore the pooler re-registered within minutes. `prisma db push` confirmed schema in sync; `db:seed` upserted 9 equipment rows; local smoke test passed (public routes 200, protected routes 307→login, bogus share token 404).
- Current priority: Vercel deploy (env vars, Blob store, Supabase redirect URLs) → end-to-end phone test.

## Recent Major Changes

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

### 2026-05-29 - Pass 14
**Summary**
- Built a new Remotion marketing composition system around the full onboarding-to-render workflow using ordered product screenshots.
- Added three production formats from a single narrative composition:
  - HVACHook16x9 (homepage hero),
  - HVACHook1x1 (feed ads/posts),
  - HVACHook9x16 (reels/stories).
- Added a HyperFrames-compatible project (marketing/hyperframes-hvac-hook) with:
  - visual identity spec (DESIGN.md),
  - HTML + GSAP timed composition (index.html),
  - mirrored screenshot assets and usage docs.
- Normalized and copied source screenshots into dedicated asset folders for both pipelines.

**Code touched**
- marketing-remotion/src/Composition.tsx
- marketing-remotion/src/Root.tsx
- marketing-remotion/README.md
- marketing-remotion/public/screenshots/hvac-flow/*
- marketing/hyperframes-hvac-hook/index.html
- marketing/hyperframes-hvac-hook/DESIGN.md
- marketing/hyperframes-hvac-hook/README.md
- marketing/hyperframes-hvac-hook/assets/screenshots/*
- RECENT_LOG.md
- HISTORY_ARCHIVE.md

**Verification**
- `npm run lint` (in `marketing-remotion`) passed.
- Remotion render command currently blocked in this environment by spawn EPERM (esbuild child process launch), so MP4 rendering must be executed in an environment that allows child-process spawning.

### 2026-05-29 - Pass 15
**Summary**
- Fixed Remotion composition ID validation failure at localhost by removing underscores from composition IDs.
- Standardized composition IDs in `Root.tsx` to match existing render/readme commands:
  - `HVACHook16x9`
  - `HVACHook1x1`
  - `HVACHook9x16`

**Code touched**
- marketing-remotion/src/Root.tsx
- RECENT_LOG.md

**Verification**
- Local `npx remotion compositions` check in this environment still hits `spawn EPERM` (same sandbox limitation), but the invalid ID source was removed from `Root.tsx`.
