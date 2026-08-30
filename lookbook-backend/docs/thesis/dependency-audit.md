# §13.5.2 — Dependency Audit

`npm audit` results for `lookbook-backend`, run **2026-08-18**, re-verified
live **2026-08-27** (both `npm audit --json` results identical to the
original run — no drift in 9 days). Runtime (dependencies) vs dev-tooling
(devDependencies) are separated because the two have very different blast
radius.

## Result summary

```
info 0   low 0   moderate 0   high 2   critical 0
```

Both remaining findings are **transitive, dev-only** and carry no runtime
exposure. `nodemailer` (the one direct dependency that was vulnerable) has
been upgraded from 6.x → 9.x and is now clean.

## Vulnerabilities

| Package | Severity | Direct? | Path | Status |
|---|---|---|---|---|
| `nodemailer` (≤9.0.0) | high | **yes** | runtime — SMTP command injection, CRLF header injection, DoS, cert-validation bypass (GHSA-mm7p, GHSA-c7w3, GHSA-vvjj, GHSA-268h, GHSA-wqvq, GHSA-r7g4, GHSA-p6gq, GHSA-rcmh) | ✅ **FIXED** → `^9.0.5` (`package.json` + lockfile) |
| `brace-expansion` | high | no | dev-only: `eslint → glob → minimatch` (GHSA-mh99 DoS) | ⚠️ tracked |
| `js-yaml` | high | no | dev-only: `eslint → @eslint/eslintrc` | ⚠️ tracked |

## Remediation plan (tracked)

- `brace-expansion` / `js-yaml` reach the app only via the ESLint toolchain
  (`eslint@8`, `@typescript-eslint@7`, jest's `glob`/`minimatch`). No runtime
  code path touches them. Fixing requires a dev-toolchain major bump
  (`eslint 9` + `typescript-eslint 8`), which is a separate, risk-controlled
  change — not bundled into the Phase 13 evaluation work.
- Re-run `npm audit` after every dependency bump; treat any new `high`/
  `critical` in `dependencies` (not dev) as blocking before release.

## Frontend

`npm audit` on `lookbook-frontend` reported 6 high findings
(`react-router`/`react-router-dom` 7.12–7.18 RSC CSRF advisory, plus dev-only
`postcss`, `nanoid`, `undici`, `brace-expansion`). The React Router advisory
only affects RSC/framework mode (this app is an SPA using `BrowserRouter`),
but `npm audit fix` resolved the in-range issues non-breakingly:

```text
$ npm audit fix
changed 6 packages ... found 0 vulnerabilities
```

The frontend now reports **0** vulnerabilities.

## Backend audit evidence

```text
$ npm audit --json  # backend, after nodemailer upgrade
VULNS: {"info":0,"low":0,"moderate":0,"high":2,"critical":0,"total":2}
  brace-expansion: high  isDirect=false  (dev: eslint/glob/minimatch)
  js-yaml:         high  isDirect=false  (dev: eslint)
```