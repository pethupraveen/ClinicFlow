# ClinicFlow WhatsApp

A WhatsApp receptionist for small clinics: appointment booking, FAQs, reminders and human handoff. One multi-tenant SaaS for every clinic.

**Status:** Phase 1 (public landing page) is done. The demo (`/demo`) and signup (`/signup`) routes are placeholders until Phases 2 and 4.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Vitest. PostgreSQL arrives with signup (Phase 4).

## Run

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run lint
npm run build && npm start   # production
```

This needs a Node server host (e.g. Vercel or a Node container). A static export won't work, because `src/proxy.ts` runs on every page request to record marketing attribution.

## Layout

```
src/
  app/                        routes only (thin)
    (marketing)/page.tsx      landing page  /
    demo/ signup/             placeholders (noindex)
    robots.ts sitemap.ts opengraph-image.tsx twitter-image.tsx icon.svg
  proxy.ts                    sets first/last-touch attribution cookies
  lib/site.ts                 site URL, name, description, routes
  modules/
    marketing/                landing sections, copy, pricing cards
    attribution/              UTM / referrer parsing (pure, tested)
    subscriptions/            plan catalogue: prices, limits, trial length
```

## Rules this code follows

- **No hard-coded prices, limits or trial length.** Everything comes from `modules/subscriptions/plans.seed.json` through `plans.ts`, which validates it when the module loads, so a bad edit fails the build. In Phase 10 this moves to the `plans` / `plan_limits` tables.
- **Marketing pages ship almost no JS of their own.** Sections are server components. The FAQ uses `<details>`. The only client component is the phone-only sticky CTA.
- **Attribution cookies** (`cf_vid`, `cf_ft`, `cf_lt`) are httpOnly and set server-side, so they work in Instagram's in-app browser without client JS. Treat them as untrusted input and always read them back through `decodeTouch()`.
