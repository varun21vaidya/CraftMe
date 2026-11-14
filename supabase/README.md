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
| Become an Artist | `migrations/0023_onboarding.sql`, `functions/api` (`confirmPhone`, `confirmFeePayment`, `/sms-hook`) | The details form, one `fee_orders` row per fee payment (a second payment is refunded), the WhatsApp phone check. Needs the phone secrets and Auth settings below |
| Account | `migrations/0022_account.sql`, `functions/api` (`deletions` job, `instagramDeleteMyData`) | Policy acceptance, the `avatars` bucket, every notification producer (triggers), deletion requests and the job that anonymises. Run the job daily with `POST /functions/v1/api/cron?job=deletions` and header `x-cron-secret`; the schedule itself comes with `0030` (P11), until then run it by hand |
| Instagram connection | `migrations/0009_instagram.sql`, `0011_instagram_unified.sql`, `functions/api/instagram*.ts/js` | Private account/state/deletion tables, verified locks, and the Instagram commands and `/instagram/*` routes (`0010`/`0012` added and removed a refresh job) |

`npm run test:schema` runs all of the SQL in memory (PGlite) with 68 checks. Run it before applying a migration.

## Secrets (Supabase, never in git or `VITE_*`)

```bash
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxx --project-ref iftjiddrgigqmvsdiasw
npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the secret you type in the Razorpay webhook form> --project-ref iftjiddrgigqmvsdiasw
# RAZORPAY_KEY_SECRET is already set
```

## Phone check secrets (WhatsApp, off until all are set)

The phone check sends a 6-digit code on WhatsApp through Supabase Auth's Send SMS Hook, which calls `POST /functions/v1/api/sms-hook` (signed with Standard Webhooks). Meta needs an approved **authentication** message template.

```
npx supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..." WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_TEMPLATE=... WHATSAPP_TEMPLATE_LANG=en --project-ref iftjiddrgigqmvsdiasw
```

Dashboard (Authentication): Sign In / Providers > Phone on, with the Send SMS Hook as the provider (HTTPS, URL above, generate the secret there and use it as `SEND_SMS_HOOK_SECRET`); Confirm phone on, OTP length 6, expiry 600 seconds, minimum 60 seconds between sends. Locally the phone `919000000001` accepts the code `123456` (`[auth.sms.test_otp]` in `config.toml`) and nothing is sent. Without these secrets the browser says phone checks are not working.

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
3. **Auth URLs**: Authentication > URL Configuration. Set the Site URL to the Vercel production URL and add it, plus `http://localhost:5173`, to the redirect list. Google now returns people to `/login`, so the list must also hold `https://<site>/login` and `http://localhost:5173/login` (the local stack has both in `config.toml`).

## Known gaps

- Instagram connect, SendGrid emails and daily analytics from the Firebase version are not ported.
- The UI reads by polling (4 to 30 seconds) instead of live listeners.
