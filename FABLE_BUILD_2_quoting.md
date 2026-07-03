# FABLE_BUILD_2 — Quoting & Proposals + Watermark

> Build 2 of 3. Read `AGENTS.md`, `ARCHITECTURE_MAP.md`, `RECENT_LOG.md`, and
> `FABLE_BUILD_SPEC.md` first. **Assumes Build 1 is merged** (plans on `Organization`,
> branding fields, abuse layer). Track progress in `RECENT_LOG.md` (Pass #). Honor §Guardrails.

## Why this build
The sellable customer-facing artifact: a brandable proposal built from a render that attaches to
whatever quoting tool the contractor already uses. **This app does not replace their quoting
system** — it produces a beautiful render + one-pager that rides inside their workflow (share link /
PDF; later, pushed via FSM API in a future build). Also adds the free-tier watermark (needs the plan
from Build 1 and branding from Build 1).

## 1. Quote / proposal
- New `Quote` model: `id`, `job_id`/`render_id`, `user_id`, `org_id`, `customer_name`,
  `customer_email`, `line_items` (JSON `[{description, qty, unit_price}]`), `notes`, `subtotal`,
  `tax_rate`, `tax`, `total`, `status` (`draft|sent|accepted|declined`), `share_token`,
  `share_expires_at`, `viewed_count`, timestamps. Keep line items **structured** — a future
  auto-fill (Google-Maps property data) will populate them.
- **Gate by plan**: only Pro/Team can create quotes (free tier sees an upsell). Enforce server-side.
- From `/renders/[id]`, a "Create proposal" flow: customer name/email + editable line items + tax
  rate → compute totals → save `Quote`.
- Manage proposals: list on the dashboard (or a `/proposals` view), edit draft, mark sent.

## 2. Branded PDF
- Generate a one-page PDF: result image + before/after + company branding (logo, name, phone,
  license from `Organization`) + customer info + line-item table + subtotal/tax/total + notes.
- **Use `@react-pdf/renderer` or `pdf-lib` — NOT Puppeteer/Chromium** (headless browsers are heavy
  and fragile on Vercel serverless). Downloadable from the proposal, and attachable to any quote.

## 3. Customer-facing proposal page
- Extend the public `/share/[token]` (or a new `/proposal/[token]`) to render the full proposal for
  the customer: render image, before/after, line items, total, company branding, `robots: noindex`.
- **Accept** action → sets `Quote.status = accepted` and `Render.quote_accepted = true`;
  increment `viewed_count` on view.
- Keep it mobile-first — most customers open it from a texted link.

## 4. Free-tier watermark
- For free-plan orgs, composite a semi-transparent brand/watermark onto the result image (sharp
  overlay) in **both** finalize paths: `workers/render-job.ts` and the eager-finalize in
  `app/api/jobs/[id]/route.ts`. Gate strictly by `Organization.plan`. Paid tiers: no watermark.

## Data model (Prisma)
New `Quote` + enum `QuoteStatus`. Reuse `Render.quote_accepted` (already exists). Migration per the
approach chosen in Build 1.

## Guardrails (from AGENTS.md)
Budget guard · viability gate · `QueueAdapter` only · scope every query to user/org (a customer
viewing `/proposal/[token]` is unauthenticated — scope by token + expiry + non-empty result, like
the existing share page) · keep the `after()` queue model · `PREVIEW_MODE` off in prod ·
update `RECENT_LOG.md`.

## Verification
- Pro user creates a proposal → totals compute correctly → PDF downloads with branding + line items.
- Free user cannot create a proposal (gated) → sees upgrade prompt.
- Share/proposal link opens logged-out on a phone; **Accept** flips status + `quote_accepted`;
  view count increments; tampered/expired token → 404.
- Free-tier render carries a watermark; Pro render does not.
- `npm run lint && npm run build` clean; end-to-end render still works on mobile.
