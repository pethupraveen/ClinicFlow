# ClinicFlow WhatsApp

A WhatsApp receptionist for small clinics: appointment booking, FAQs, reminders and human handoff. One multi-tenant SaaS for every clinic.

**Status:**

| Phase | What | State |
|---|---|---|
| 1 | Public landing page, SEO, UTM attribution | Done |
| 2 | Interactive demo at `/demo`: WhatsApp booking → simulated dashboard → trial CTA | Done |
| 3 | Privacy-safe demo analytics | Done |
| 4 | Sign in with Google, first-time clinic setup, `/app` home | Done |
| 5 | 15-day TRIAL subscription created with each clinic; daily expiry job | Built |
| 6+ | Onboarding, trial dashboard, usage, subscriptions | Not started. `/book-demo` is a placeholder |

## Stack
Next.js 16 (App Router, Turbopack), React 19, TypeScript, Vitest, and Supabase Postgres (via `postgres.js`) through Vercel Marketplace.

## Run

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run lint
npm run build && npm start   # production

# Once the Supabase variables are present (never commit them):
npx vercel env pull .env.local
node --env-file=.env.local scripts/migrate.mjs
```

## Deploy

The app is deployed on **Vercel**, which is connected to this repo: pushes to `main` go to production, and other branches get preview URLs. There's nothing extra to configure.

- `NEXT_PUBLIC_SITE_URL` is optional. Without it, canonical URLs, Open Graph and the sitemap use Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`). Set it in Vercel → Project → Settings → Environment Variables once a custom domain exists.
- **GitHub Pages won't work.** It only serves static files, and this app needs a server: `src/proxy.ts` runs on every page request and Phase 3 records server-side analytics. Keep Pages disabled for this repo.

## Database setup

Install the Supabase integration from Vercel Marketplace and connect it to the `clinic-flow` project for Production, Preview and Development. Check that `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` appear (or their `STORAGE_`-prefixed forms, which the app also reads) with `npx vercel env ls production`. Then pull the variables and run the migrations once, as shown above. Redeploy after changing environment variables.

The app uses the pooled `POSTGRES_URL` (Supabase's transaction pooler, so prepared statements are off). Migrations use the direct `POSTGRES_URL_NON_POOLING`. Any other Postgres works through `DATABASE_URL`. Migration `0002` enables row-level security, so Supabase's public Data API can't read or write the analytics tables.

## Authentication setup (Phase 4)

Clinics sign in with **Google only**, through Supabase Auth. Only the server talks to Supabase, so the browser never gets a Supabase key and auth cookies are `HttpOnly`. The first sign-in asks for the clinic name at `/welcome`. Our tables (`profiles`, `businesses`, `business_members`, rate limits, audit log) come from migration `0003`.

**Google Cloud Console**
- Create an OAuth client of type *Web application*.
- Set its authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.

**Supabase → Authentication**
- Enable the **Google** provider with that client ID and secret.
- Under URL Configuration, set the Site URL to the production URL.
- Add `https://<production-domain>/auth/callback` and `http://localhost:3000/auth/callback` to the redirect URLs.

Every variable is read with or without the `STORAGE_` prefix. `AUTH_RATE_LIMIT_SALT` is optional and falls back to the Supabase service key.

## Trials (Phase 5)

Every clinic gets a TRIAL subscription in the same transaction that creates it. Signup day is day 0, and the trial ends at midnight at the start of day 15 in the clinic's time zone (`businesses.time_zone`, default `Asia/Kolkata`). The app treats a trial as expired from that instant (`effectiveStatus`). A daily Vercel Cron job (`vercel.json`, 19:00 UTC ≈ 00:30 IST) calls `/api/cron/expire-trials` to save the expiry and log `TRIAL_EXPIRED`. Set `CRON_SECRET` in Vercel: the endpoint rejects any request without `Authorization: Bearer $CRON_SECRET`.

## Layout

```
src/
  app/                        routes only (thin)
    (marketing)/page.tsx      landing page  /
    demo/page.tsx             interactive demo  /demo
    (auth)/                   signup, login (Google), welcome = first-time clinic setup (noindex, per-request)
    auth/google, auth/callback  start Google sign-in / exchange the code for a session
    app/                      signed-in clinic app (guarded)
    book-demo/                placeholder (noindex)
    robots.ts sitemap.ts opengraph-image.tsx twitter-image.tsx icon.svg
  proxy.ts                    sets first/last-touch attribution cookies
  lib/site.ts                 site URL, name, description, routes
  modules/
    marketing/                landing sections, copy, pricing cards
    demo/                     demo state machine, fixtures, chat + dashboard UI (client-only)
    attribution/              UTM / referrer parsing (pure, tested)
    analytics/                event whitelist, demo session security, Postgres data access
    auth/                     Supabase Auth client, clinic creation, guards, rate limits, CSP
    trial/                    trial dates, effectiveStatus, subscription store, expiry job auth
    subscriptions/            plan catalogue: prices, limits, trial length
```

## Rules this code follows

- **No hard-coded prices, limits or trial length.** Everything comes from `modules/subscriptions/plans.seed.json` through `plans.ts`, which validates it when the module loads, so a bad edit fails the build. In Phase 10 this moves to the `plans` / `plan_limits` tables.
- **Marketing pages ship almost no JS of their own.** Sections are server components. The FAQ uses `<details>`. The only client component is the phone-only sticky CTA.
- **The demo never touches real clinic data.** Its booking state remains a pure browser-side fixture in `sessionStorage`. It sends only whitelisted, pseudonymous analytics events to its own server; no patient, appointment, contact or free-form event data is accepted. Nothing in `modules/demo` may import tenant modules.
- **Attribution cookies** (`cf_vid`, `cf_ft`, `cf_lt`) are httpOnly and set server-side, so they work in Instagram's in-app browser without client JS. Treat them as untrusted input and always read them back through `decodeTouch()`.
