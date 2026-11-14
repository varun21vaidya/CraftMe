# P05 verification record

Branch `craftme/p05-seller-onboarding` (cut from P04's `main`). Environment: local stack, `seed_qa.sql`, `api` function served locally (`PROVIDER_MODE=fake`), Playwright with Microsoft Edge.

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` | pass (`onboarding.test.js`, `whatsapp_pure.test.js` included) |
| `npm run test:schema` | pass (301 checks when P05 was finished; 332 with P06) |
| `e2e/become-artist.spec.js`, desktop-light | last complete run: 11 passed, 7 failed. Causes found and fixed afterwards (below); the final re-run was not finished when this was written, so those 7 are **unverified** |

## Scenarios

| ID | Result | Evidence |
| --- | --- | --- |
| QA-S18-01, 02 (UI) | passed | `become-artist.spec.js` (the earlier failures were a backspace character in the test's label pattern) |
| QA-S18-02 (server) | passed | bank method with no holder and a bad IFSC refused; `schema.test.mjs` |
| QA-S18-03 | unverified | needs a real WhatsApp template and Meta test number (Gate B) |
| QA-S18-04 | unverified after the fixes | the local test code was refused because phone confirmations were off, so Auth set the number without a code. Fixed: `enable_confirmations = true` in `config.toml` (production: "Confirm phone" on). The code boxes also lost digits when a middle box was cleared; fixed. The server's one-send-a-minute limit does not apply to a test-code number, so step 5 on the server is a sandbox check |
| QA-S18-05, 06 | unverified | same re-run |
| QA-S18-07 | partly passed | the page's "charged twice" notice passed; the rest is part of the re-run. Database half (second payment refunded, recorded once) is in `schema.test.mjs` |
| QA-S18-08 | unit passed (`onboarding.test.js`); e2e unverified | |
| QA-S18-09 | passed | closed switch, fee not set, existing Artist. Run 3 (payments not set up) is simulated; the server answer `payments_not_configured` needs the function served without keys |

## Changes against the plan

- Supabase Auth gives one "wrong or expired" answer, so the page words it from the age of the code.
- The unpaid-fee check on arrival cannot know the keys are missing; "Payments aren't set up" shows after the first press and the button stays disabled.
- P06 removed the Artist links from the public header; the account menu and footer keep them.

## Changed paths

`supabase/migrations/0023_onboarding.sql`, `supabase/config.toml`, `supabase/README.md`, `supabase/schema.test.mjs`, `supabase/functions/api/{index.ts,whatsapp_pure.js,whatsapp_pure.test.js}`, `src/api/gateway.js`, `src/App.jsx`, `src/components/{common/Layout.jsx,ui/CodeInput.jsx,onboarding/*}`, `src/lib/{format.js,onboarding.js,onboarding.test.js}`, `src/pages/BecomeArtistPage.jsx`, `e2e/become-artist.spec.js`.

## Migration order and remaining work

`0023_onboarding.sql` after `0022`. Not applied to the hosted project. Still to do: re-run `become-artist.spec.js`; real WhatsApp (Gate B); the Edge Function with the new commands and `/sms-hook` is not deployed; set the Auth hook and secrets as in `supabase/README.md`.
