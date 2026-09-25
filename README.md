# ClinicFlow WhatsApp

A WhatsApp receptionist for small clinics: appointment booking, FAQs, reminders and human handoff. One multi-tenant SaaS for every clinic.

**Status:**

| Phase | What | State |
|---|---|---|
| 1 | Public landing page, SEO, UTM attribution | Done |
| 2 | Interactive demo at `/demo`: WhatsApp booking → simulated dashboard → trial CTA | Done |
| 3 | Privacy-safe demo analytics | Done |
| 4+ | Signup, 15-day trial, onboarding, subscriptions | Not started. `/signup` and `/book-demo` are placeholders |

## Stack
Next.js 16 (App Router, Turbopack), React 19, TypeScript, Vitest, and Neon PostgreSQL through Vercel Marketplace.

## Run

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run lint
npm run build && npm start   # production

# Once DATABASE_URL is present (never commit it):
npm run db:migrate
```

## Deploy

The app is deployed on **Vercel**, which is connected to this repo: pushes to `main` go to production, and other branches get preview URLs. There's nothing extra to configure.

- `NEXT_PUBLIC_SITE_URL` is optional. Without it, canonical URLs, Open Graph and the sitemap use Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`). Set it in Vercel → Project → Settings → Environment Variables once a custom domain exists.
- **GitHub Pages won't work.** It only serves static files, and this app needs a server: `src/proxy.ts` runs on every page request and Phase 3 records server-side analytics. Keep Pages disabled for this repo.

## Database setup

Create the Neon native integration through Vercel Marketplace and connect it to Production, Preview and Development. Verify the server-only `DATABASE_URL` variable appears in each environment, then run `npm run db:migrate` once against the production connection. Redeploy after changing environment variables.

## Layout

```
src/
  app/                        routes only (thin)
    (marketing)/page.tsx      landing page  /
    demo/page.tsx             interactive demo  /demo
    signup/ book-demo/        placeholders (noindex)
    robots.ts sitemap.ts opengraph-image.tsx twitter-image.tsx icon.svg
  proxy.ts                    sets first/last-touch attribution cookies
  lib/site.ts                 site URL, name, description, routes
  modules/
    marketing/                landing sections, copy, pricing cards
    demo/                     demo state machine, fixtures, chat + dashboard UI (client-only)
    attribution/              UTM / referrer parsing (pure, tested)
    analytics/                event whitelist, demo session security, Neon data access
    subscriptions/            plan catalogue: prices, limits, trial length
```

## Rules this code follows

- **No hard-coded prices, limits or trial length.** Everything comes from `modules/subscriptions/plans.seed.json` through `plans.ts`, which validates it when the module loads, so a bad edit fails the build. In Phase 10 this moves to the `plans` / `plan_limits` tables.
- **Marketing pages ship almost no JS of their own.** Sections are server components. The FAQ uses `<details>`. The only client component is the phone-only sticky CTA.
- **The demo never touches real clinic data.** Its booking state remains a pure browser-side fixture in `sessionStorage`. It sends only whitelisted, pseudonymous analytics events to its own server; no patient, appointment, contact or free-form event data is accepted. Nothing in `modules/demo` may import tenant modules.
- **Attribution cookies** (`cf_vid`, `cf_ft`, `cf_lt`) are httpOnly and set server-side, so they work in Instagram's in-app browser without client JS. Treat them as untrusted input and always read them back through `decodeTouch()`.
