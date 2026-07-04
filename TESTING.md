# TESTING.md — Local vs Live

## The two environments

| | Local | Live (production) |
|---|---|---|
| Start / update | `npm run dev` → http://localhost:3000 | `npm run deploy` (builds + ships current working tree) |
| Env vars | `.env.local` | Vercel dashboard (or `npx vercel env add`) |
| Database | **Same Supabase DB as live** — data created locally shows up in live and vice versa | same |
| URL for phone | needs same-Wi-Fi + firewall fiddling — usually easier to just deploy | https://hvac-visualizer.vercel.app |

Rules of thumb:
- **Iterating on code/UI** → local. **Anything touch/camera/PWA** → `npm run deploy`, test on the phone.
- `npm run deploy:preview` gives a throwaway URL without touching production (env vars are already set for Preview too).
- Git push does **not** deploy — the Vercel project isn't GitHub-linked yet (Project → Settings → Git to change that). Until then, `npm run deploy` is the ship button.
- Instant rollback: Vercel dashboard → Deployments → ⋯ → Promote a previous deployment.

## Test-account tricks

- **`DEV_UNLOCK_ALL_FEATURES=true`** (currently ON in `.env.local` and Vercel prod+preview): every account gets all features — quoting, branding, no watermark, 3000 renders/mo. Settings shows "Dev (all features unlocked)". Cost guardrails stay active (render budget cap, global daily cap, Team-level daily spend ceiling). **Delete the env var everywhere before launch** — real plan gates resume automatically.
  - To test *gated* behavior (watermark, 402 upsell, quote gate) while developing: set it to `false` locally and restart the dev server.
- **Flip your org to Pro/free** (for testing the real plan gates end-to-end): `npm run db:studio` → `Organization` → edit `plan` (`free`/`pro`/`team`). No Stripe needed.
- **Stuck "confirm your email" signup**: either turn confirmation off (Supabase → Authentication → Sign In / Providers → Email → uncheck "Confirm email") or admin-confirm the user with the service-role key (`auth.admin.updateUserById(id, { email_confirm: true })`).
  - ⚠️ Re-enable "Confirm email" before opening signups to the public — it's abuse-layer step 1 (see FABLE_BUILD_1 §1.1).
- **Reset the monthly render cap** while testing: raise `RENDER_LIMIT_FREE` locally, or flip the org to `pro`.

## Feature → required keys

Works with the keys already present (local + Vercel): auth, full render pipeline, slider, watermark, share links, proposals/PDF (with plan flip), leads list, projects, dashboard stats.

Dormant until keys are added (all no-op safely):

| Feature | Keys | Notes |
|---|---|---|
| CAPTCHA | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare test keys: site `1x00000000000000000000AA` (always passes), secret `1x0000000000000000000000000000000AA` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | free Upstash Redis |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID_PRO/TEAM` | test card `4242 4242 4242 4242`; local webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Email | `RESEND_API_KEY` (+ `EMAIL_FROM` once a domain is verified) | free tier can send to your own address from `onboarding@resend.dev` |
