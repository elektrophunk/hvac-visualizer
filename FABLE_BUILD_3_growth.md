# FABLE_BUILD_3 — Growth & Stickiness

> Build 3 of 3. Read `AGENTS.md`, `ARCHITECTURE_MAP.md`, `RECENT_LOG.md`, and
> `FABLE_BUILD_SPEC.md` first. **Assumes Builds 1–2 are merged** (plans, branding, `Quote`,
> proposal share page). Track progress in `RECENT_LOG.md` (Pass #). Honor §Guardrails.

## Why this build
Turn one-off renders into repeat usage and inbound leads: better customer-facing presentation,
lead capture, notifications, organization, and visibility into what's working.

## External accounts needed
- **Resend** (email) — `RESEND_API_KEY`, a verified sender domain/address.

## 1. Before/after slider
- Interactive draggable before/after slider component. Use it on `/renders/[id]`, the public
  `/share/[token]` / `/proposal/[token]` page, and the proposal — replacing the static side-by-side.
- Mobile-first (touch drag).

## 2. Good / Better / Best
- Let a `Quote` bundle **multiple render options** with per-option pricing (e.g. link several
  renders to one proposal, each with its own line items/total), shown side by side on the customer
  page so the homeowner can pick a tier. Extend the `Quote` model (or add `QuoteOption`) accordingly.

## 3. Lead capture
- On the public share/proposal page, a "Request a quote / Contact us" form.
- New `Lead` model: `name`, `phone`, `email`, `message`, `render_id`/`quote_id`, `org_id`,
  `status` (`new|contacted|closed`), `created_at`. Scope reads to the owning org.
- On submit → create `Lead` → **notify the contractor by email** (§4). Show leads in the dashboard.
- This turns every shared render into an inbound lead — the main growth lever.

## 4. Email notifications (Resend)
- Send transactional email for: render complete, "your customer viewed your proposal", and new lead.
- Also implement the deferred **weekly cost-report email** (`app/api/cron/cost-report/route.ts` TODO,
  `WEEKLY_COST_REPORT_EMAIL`).
- Keep sends fire-and-forget / non-blocking; failures must not break the request path.

## 5. Projects
- Activate the existing `Project` model: group jobs/renders under a customer or job.
- Project picker in `/new`; filter `/dashboard` by project.

## 6. Analytics
- A dashboard tab: renders used vs plan limit, proposals sent / viewed / accepted, acceptance rate,
  leads captured. Source from `Quote.status`, `Render.quote_accepted`, `share`/`viewed_count`, `Lead`.

## Data model (Prisma)
New `Lead` + enum `LeadStatus`; extend `Quote` (or add `QuoteOption`) for Good/Better/Best; activate
`Project` relations. Migration per the approach chosen in Build 1.

## Guardrails (from AGENTS.md)
Budget guard · viability gate · `QueueAdapter` only · scope every query to user/org (public lead
form is unauthenticated — accept only via a valid share/proposal token, and rate-limit it to prevent
lead spam) · keep the `after()` queue model · `PREVIEW_MODE` off in prod · update `RECENT_LOG.md`.

## Verification
- Before/after slider drags smoothly on desktop + phone.
- A proposal with Good/Better/Best options shows all tiers with prices on the customer page.
- Lead form on the share page creates a `Lead` and emails the contractor; the lead appears in the
  dashboard; the form is rate-limited against spam.
- Render-complete / proposal-viewed / new-lead emails send; weekly cost-report email works.
- Projects group renders; dashboard filters by project.
- Analytics tab shows correct counts.
- `npm run lint && npm run build` clean; end-to-end render still works on mobile.
