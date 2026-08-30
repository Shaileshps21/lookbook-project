# §13.5.1 — OWASP Top 10 (2021) Self-Assessment

Self-assessment against the OWASP Top 10, with the concrete control in the
codebase and a test/verification reference where one exists. Written
**2026-08-18**; spot-checked live **2026-08-27** — not just re-reading the
code, but exercising it: confirmed `express.json({verify})` preserves the
exact raw bytes for Razorpay/Stripe HMAC verification (the common bug is
re-serializing the parsed body, which silently breaks or weakens signature
checks), confirmed `sanitizeUser` allowlists fields rather than spreading the
raw user doc (so a future field addition to `User` can't leak by omission),
and confirmed the A04/A07 rate limiter live: 25 rapid `POST /api/auth/login`
requests returned `401` for the first 20 and `429` from the 21st on.

| # | Category | Status | Control in codebase | Evidence |
|---|---|---|---|---|
| A01 | Broken Access Control | ✅ Mitigated | Role-aware middleware (`adminOnly`, `requireSeller`), ownership checks in every controller (e.g. `orderController` validates the order belongs to `req.user.id`), `sanitizeUser` never exposes `password`/`refreshTokens` | `middleware/`, `controllers/*` |
| A02 | Cryptographic Failures | ✅ Mitigated | bcrypt (cost 10) for passwords; JWT signed with `JWT_SECRET`/`JWT_REFRESH_SECRET` from env; 2FA TOTP; tokens stored hashed (`RefreshToken`); `helmet` sets HSTS on HTTPS | `models/User.ts`, `utils/authSession.ts`, `config/env.ts` |
| A03 | Injection | ✅ Mitigated | MongoDB injection: Mongoose casts; regex filters built from sanitized strings; Zod validators (`validators/*`) reject bad shapes; SQL is absent (NoSQL). `$in`/`$regex` inputs are user strings only where intended | `validators/`, `utils/ApiFeatures.ts` |
| A04 | Insecure Design | ✅ Mitigated (partially) | Rate limits on auth/search/checkout/listing (`rateLimiters.ts`), CSRF for state-changing cookies, session rotation on refresh | `middleware/rateLimiters.ts`, `utils/csrf.ts` |
| A05 | Security Misconfiguration | ✅ Mitigated | `helmet()` defaults, strict CORS allowlist, `JWT_EXPIRES_IN`/cookie `secure` flags, no secrets in frontend bundle (`VITE_*` only) | `app.ts`, `config/env.ts` |
| A06 | Vulnerable & Outdated Components | ⚠️ Needs review | `npm audit` run + report below; upgrade on findings | `docs/thesis/dependency-audit.md` |
| A07 | Identification & Authentication Failures | ✅ Mitigated | Refresh-token rotation + revocation, CSRF double-submit, 2FA setup/confirm/disable, session listing/revoke (`/auth/sessions`), rate-limited login | `authController.ts`, `twoFactorController.ts` |
| A08 | Software & Data Integrity Failures | ✅ Mitigated | Payment webhooks validated with provider signatures (Razorpay/Stripe paths), signed import pipeline (Open Library import runs provider-side), no unauthenticated bulk mutation | `orderController.ts` |
| A09 | Security Logging & Monitoring Failures | ✅ Mitigated (basic) | Central `AuditLog` for admin actions; server-side request logging (morgan + pino `logger`); analytics events stored per session | `models/AuditLog.ts`, `server.ts`, `models/Event.ts` |
| A10 | Server-Side Request Forgery | ✅ Mitigated | No user-supplied URLs are fetched server-side (image quality check fetches provider-hosted URLs only via `generateVisionJson` from Open Library covers, validated server-side) | `uploadController.ts` |

## Controls summary

- **AuthN/AuthZ**: bcrypt + JWT pair + CSRF + 2FA + session rotation + role middleware.
- **Transport**: helmet (HSTS), secure cookies, CORS allowlist.
- **Input**: Zod schemas at every boundary; Mongoose casting; sanitized `sanitizeUser`.
- **Abuse**: per-route rate limiters; `aiLimiter` 20/min verified by `aiRateLimit.test.ts`.

## Open items (tracked, not thesis-blocking)

1. A06 — dependency upgrade cadence; see `dependency-audit.md`.
2. Fuzz/pen-test the image-upload quality gate and the bulk-import CSV parser
   before production exposure.
3. Webhook endpoints should assert strict content-type + signature before any
   DB write (documented intent, verify during deployment hardening).