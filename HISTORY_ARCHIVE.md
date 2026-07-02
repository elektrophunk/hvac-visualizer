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

*(No entries yet — archive begins empty for this project. Entries will be moved here from RECENT_LOG.md as they age out.)*
