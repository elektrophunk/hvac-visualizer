# History Archive

Older entries from `RECENT_LOG.md` are moved here when the log exceeds 300 lines or entries are older than 14 days.

---

## Architecture Patterns

### Budget Guard (Required Before Any Paid API Call)

Before calling Claude or fal.ai, estimate the combined cost and compare against the cap:

```typescript
const CLAUDE_ESTIMATED_COST_USD = 0.022;
const totalEstimate = CLAUDE_ESTIMATED_COST_USD + falCostUsd();
const cap = parseFloat(process.env.RENDER_BUDGET_CAP_USD ?? "0.40");

if (totalEstimate > cap) {
  // mark job failed, failure_detail: "render_budget_exceeded", no retry
  return;
}
```

**Why:** Prevents runaway spend from misconfigured env vars. This is a configuration failure, not a transient error — do not retry.

**Where:** `workers/render-job.ts` Phase A Step 2.

---

### Viability Gate (Avoid Unnecessary fal.ai Calls)

If Claude returns `request_viable === false` and the job does not have `force_generate: true`, complete the job immediately without calling fal.ai:

```typescript
if (!analysisOutput.result.request_viable && !job.force_generate) {
  // update: status = completed, placement_viable = false, result_url = null
  // log event with status: "not_viable"
  return; // ack the message, no fal call
}
```

UI shows a viability message with `viability_reason` and a "Generate anyway" button that re-submits with `force_generate: true`.

**Why:** Avoids charging the user for a generation that Claude has determined is physically impossible from the photo.

---

### Two-Phase Worker (analyze → poll)

The queue worker handles two message types keyed by `phase`:
- `phase: "analyze"` — initial message: Claude + fal submit
- `phase: "poll"` — polling message: check fal status, re-enqueue or finalize

Poll messages include `{ jobId, falRequestId, pollAttempt }`. Max 10 poll attempts at 30s intervals (≈ 5 min coverage). On timeout (`pollAttempt >= 10`), mark job `failed` with reason `TIMEOUT`.

**Where:** `workers/render-job.ts`

---

## Archived Log Entries

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
