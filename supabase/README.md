# CraftMe on Supabase

Project `iftjiddrgigqmvsdiasw` (Mumbai, `ap-south-1`).

| Part | Where | What it does |
|---|---|---|
| Schema, RLS, grants | `migrations/0001`, `0002` | Tables, row level security, column-level grants |
| Business logic | `migrations/0003_logic.sql` | Postgres functions: `place_order`, `mark_paid`, refunds, payouts, sweep, triggers. One transaction each |
| Storage | `migrations/0004_storage.sql` | Buckets `artworks`, `videos` (public) and `damage` (private) with per-user folders |
| Schedules | `migrations/0005_cron.sql` | `sweep()` every 5 minutes; payout drafts on the 1st and 15th, 09:00 IST |
| Razorpay and role commands | `functions/api` | Edge Function: `placeOrder`, `confirmPayment`, `issueRefund`, `payOnboardingFee`, `becomeArtist`, `setRole`, and the webhook at `/functions/v1/api/webhook` |
| Catalogue | `migrations/0006_catalogue.sql` | 21 categories in 5 groups, listing kind `product` |
| Reels | `migrations/0008_reels.sql` | Artists' reel links, limits (12 reels, 6 highlighted), product link |
| Instagram connection | `migrations/0009_instagram.sql`, `0011_instagram_unified.sql`, `functions/api/instagram*.ts/js` | Private account/state/deletion tables, verified locks, and the Instagram commands and `/instagram/*` routes (`0010`/`0012` added and removed a refresh job) |

`npm run test:schema` runs all of the SQL in memory (PGlite) with 68 checks. Run it before applying a migration.

## Secrets (Supabase, never in git or `VITE_*`)

```bash
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxx --project-ref iftjiddrgigqmvsdiasw
npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the secret you type in the Razorpay webhook form> --project-ref iftjiddrgigqmvsdiasw
# RAZORPAY_KEY_SECRET is already set
```

## Instagram secrets (off until all are set; never in git or `VITE_*`)

Instagram uses the Instagram API with Unified Login (Facebook Login for Business). The token it returns never expires, so there is no refresh job. Use the **Meta app ID and secret** (App settings, Basic), not an Instagram app ID.

```bash
npx supabase secrets set META_APP_ID=... META_APP_SECRET=... INSTAGRAM_CONFIG_ID=1687288436092442   INSTAGRAM_REDIRECT_URI=https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/callback   SITE_URL=https://craftme-india.vercel.app --project-ref iftjiddrgigqmvsdiasw
npx supabase secrets set INSTAGRAM_TOKEN_KEY=$(openssl rand -base64 32) --project-ref iftjiddrgigqmvsdiasw
```

Keep a private copy of `INSTAGRAM_TOKEN_KEY` (losing it means every artist must reconnect). In the Meta app: the redirect URL is saved in the Unified login configuration; the deauthorize callback (`.../instagram/deauthorize`) and data-deletion URL (`.../instagram/data-deletion`) go in the app settings. See `docs/INSTAGRAM_PLAN.md`.

## One-time setup in dashboards

1. **Razorpay webhook** (Dashboard > Developers > Webhooks): URL `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/webhook`, events `payment.captured` and `order.paid`, and a secret of your choosing (the same value as `RAZORPAY_WEBHOOK_SECRET`).
2. **Google sign-in**: Google Cloud OAuth client (redirect URI `https://iftjiddrgigqmvsdiasw.supabase.co/auth/v1/callback`), then Supabase Authentication > Providers > Google.
3. **Auth URLs**: Authentication > URL Configuration. Set the Site URL to the Vercel production URL and add it, plus `http://localhost:5173`, to the redirect list.

## Known gaps

- Artist onboarding requires a verified phone (`phone_verified`), which needs an SMS provider. Until one is set up, make artists with `setRole`.
- Instagram connect, SendGrid emails and daily analytics from the Firebase version are not ported.
- The UI reads by polling (4 to 30 seconds) instead of live listeners.
