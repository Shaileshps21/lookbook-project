# §13.2.4 — Bundle / Asset Audit

**Date:** 2026-08-18

Goal: extend the lazy-loading win already made on the ISBN scanner (§A.7) to
any other heavy, rarely-used chunk, and record a Lighthouse baseline for the
main flows. Lighthouse itself needs a running deployment, so the baseline is
**pending** (see below) — the bundle work below is complete and measured.

## Changes made

1. **Removed `react-icons` entirely** (Login, Register, Footer were importing
   the `react-icons/fa` barrel eagerly). Brand/social icons were rebuilt as
   tiny dependency-free inline SVGs in `components/common/SocialIcons.tsx`
   (lucide-react 1.x removed brand icons upstream), so the dependency is gone
   from `package.json` altogether.
2. **Route-level code splitting** in `routes/AppRoutes.tsx`: every page except
   `HomePage` (kept eager for LCP on the entry route) is now `React.lazy`
   wrapped in `<Suspense>` with the existing `Loader` fallback. This splits
   admin, auth, community, seller, and profile pages into their own chunks
   fetched on demand.

## Before → after (production build, minified)

| Asset | Before | After | Delta |
|---|---|---|---|
| Main entry (`index-*.js`) | 620.3 kB / 175.6 kB gz | **420.2 kB / 132.0 kB gz** | **−200 kB (−43.5 kB gz)** |
| `IsbnScanner-*.js` (lazy, unchanged) | 412.9 kB / 110.2 kB gz | 412.9 kB / 110.2 kB gz | — |

The main bundle is now under Vite's default 500 kB warning threshold, so the
build emits no chunk-size warning. Everything else splits into route chunks
ranging ~2–14 kB gz each (largest non-scanner chunk: `Profile` at 7.3 kB gz).

## How to re-measure

```
cd lookbook-frontend
npm run build        # prints per-chunk sizes + gzip
```

## Still open (needs infra)

- **Lighthouse baseline (pending):** a Lighthouse pass on home / search /
  checkout requires the stack deployed and serving traffic. Until Docker + CI
  are verified on real infra (§13.5.1), record scores from a local
  `npm run dev` run as an interim measure. Tracked in `phase-13-status.md`.
- **`recharts`-style heavy admin visualizations** were already route-split;
  the admin AB panel adds no new heavyweight dependency.