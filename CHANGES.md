# LookBook — Changes Log

Newest entries at the top. This file tracks the build-out of `future.md`'s
roadmap (Phases 1–12) plus targeted bug fixes, on top of the original
frontend↔backend wiring documented at the bottom of this file.

---

## 🐛 Session Update — 2026-08-30: Feed crash fixed (real bug), profile header spacing, club invite links now member-visible + production-safe

Three user-reported items from live testing of the previous session's build.

### Bug — `/feed` went blank after enough activity (real crash, found via Chrome console)
User report: "after i follow someone and the followers list ends, the page
becomes pure blank." Reproduced live with Claude in Chrome — console showed
`TypeError: Cannot read properties of null (reading 'id')` inside `Feed.tsx`,
thrown from `item.book.id`. Root cause: `followController.getFollowingFeed`
populates each feed entry's `book` field, and Mongoose's `populate` silently
returns `null` when the referenced book has since been deleted from the
catalog (e.g. an admin removed it) — the review/activity row itself still
exists, just pointing at nothing. `OrderHistory.tsx` already guards this
exact class of bug (`item.book ? ... : "Book no longer available"`);
`Feed.tsx` never got the same treatment and crashed the whole page with no
error boundary to catch it.
- `followService.ts` — `FeedItem.book` type is now `... | null`.
- `Feed.tsx` — both the review and activity card paths now render "a book no
  longer available" instead of linking/crashing when `item.book` is null.
- Verified live: reloaded `/feed` on an account with a real orphaned review
  (pointing at a deleted book) — page now renders both that row and a normal
  row correctly, zero console errors, no more blank page.
- No backend change needed — the API's `null` was always correct; the bug
  was purely a missing frontend guard.

### Profile — name/email repositioned
`ProfileHeader.tsx`'s name/email block sat bottom-aligned with the avatar
(`items-end` on the row, `pb-1` on the text block), landing right at the
avatar's bottom edge. Increased the block's bottom padding so the text sits
higher, closer to the top of the avatar, per request. Verified live in
Chrome.

### Clubs — invite link now member-visible and production-correct
Two changes, both scoped to what was asked:

1. **Any club member can now see and share the invite link** (copy/WhatsApp/QR
   Code) — previously that whole section only rendered for the owner/admin.
   Disabling the link, regenerating it, and removing members remain
   owner/admin-only (`canManage`), unchanged — only visibility of the
   share-the-link controls broadened, in `ClubDetail.tsx`. No backend
   authorization changed: `GET /clubs/:id` was never owner-restricted, so
   this was purely a frontend gating fix (`isMember` instead of `canManage`
   around that section; the two management-only buttons inside it stay
   individually wrapped in `canManage`).
2. **Invite links are no longer built from the browser's own origin.**
   Previously the frontend built the link as
   `${window.location.origin}/clubs/join/${token}`, which is technically
   correct per-deployment (it reflects wherever the page is actually being
   served) but doesn't match how every other outbound link in this app is
   built (`verify-email`, `reset-password` both use the backend's
   `env.clientUrl`) and left the door open to a mismatch if the app is ever
   reachable from more than one origin. Moved the URL construction
   server-side: `clubController.ts` now computes `inviteUrl` from
   `env.clientUrl` (the backend's `CLIENT_URL` env var) and attaches it to
   every club response (`getClubs`, `getClubById`, `createClub`, `joinClub`,
   `updateClub`, `removeMember`, `leaveClub`, `joinByInvite`,
   `regenerateInvite`). The frontend now just reads `club.inviteUrl` — no
   more `window.location.origin` anywhere in the club invite flow. In this
   dev environment `CLIENT_URL=http://localhost:5174`, so the link still
   shows `localhost:5174` locally (correctly — that's genuinely where the
   dev frontend runs); on a real deploy, setting `CLIENT_URL` to the
   production domain is what makes the link correct there, the same way it
   already governs every other link this app sends.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean.
- Extended `clubInvite.test.ts` with 2 new tests: `inviteUrl` exactly equals
  `${env.clientUrl}/clubs/join/${inviteToken}` on both create and a
  subsequent fetch, and a non-owner member who joined via the invite link
  gets back the same `inviteUrl` when fetching the club (confirming
  visibility was never an API-level restriction). Backend Jest **73/73**
  (was 71, +2); frontend Vitest **14/14** unchanged; `vite build` succeeds.
- Live-verified in Chrome: joined a club as a non-owner account — the
  Invite Members section appeared with a working Copy Link/WhatsApp/QR Code,
  while (per the code, `canManage`-gated) the Link Enabled/Regenerate Link
  controls only render for the owner/admin.
- Also fixed incidentally: a leftover stale service worker in the test
  browser profile (registered against a different port from a prior
  session) was serving a broken duplicate-React bundle and had to be
  unregistered before testing could proceed — not a code bug, but the same
  documented PWA-caching trap this project has hit before; noting again for
  the next person who sees an inexplicable blank page or "Invalid hook
  call" error after switching ports.

---

## 🚧 Session Update — 2026-08-30: `implementation_plan.md` build, Features 1 & 8 (GitHub OAuth intentionally skipped)

Started implementing the 10-feature `implementation_plan.md` roadmap
(Remember Me, GitHub OAuth UI, Recharts dashboard, extend-rental UI, pickup
scheduling, coupons, follow feed, profile redesign, email preferences, club
invite links) one feature at a time, testing each before moving on. Feature 2
(re-adding the GitHub OAuth button) is explicitly **skipped per the user's
instruction** — it was deliberately removed 2026-08-28 and stays that way for
now; the backend route and `oauthUrls.github` remain untouched either way.

### Feature 1 — Remember Me: already fully built, added the missing test
Auditing the plan against the live code found `rememberMe` already threaded
end-to-end: `Login.tsx`'s checkbox → `authService.loginRequest` →
`loginSchema`/`authController.login` → `issueSession` picks
`REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN_DAYS` (30d) vs
`REFRESH_TOKEN_SESSION_EXPIRES_IN_DAYS` (1d) and stores it on the
`RefreshToken` document. Nothing to build. Added the one thing missing: a
regression test (`auth.test.ts`) asserting an unchecked "Remember me" login
issues a `RefreshToken` with `rememberMe: false` and a shorter `expiresAt`
than a remembered one.

### Feature 8 — Profile page redesigned into a tabbed dashboard
Full rewrite of `Profile.tsx` from one long scroll into
`ProfileHeader` + a 6-tab layout (Overview / Orders / Reading / Community /
Addresses / Security), per the plan. `ProfileSidebar.tsx` is now fully
superseded by `ProfileHeader.tsx` and was deleted (nothing else imported it).

**Backend (new):**
- `PATCH /users/me` (`userController.updateMe`) — updates `name`/`avatar`,
  returns the sanitized user. `avatar` is validated as a URL string; the
  frontend uploads the file to the existing Cloudinary `/uploads/image`
  endpoint first and only PATCHes the resulting URL, so the backend never
  touches upload binaries here (same pattern as book covers).
- `PATCH /auth/change-password` (`authController.changePassword`) — verifies
  `currentPassword` against the stored hash, saves the new one, and revokes
  every `RefreshToken` for that user (forces re-login everywhere, same
  discipline as the existing reset-password flow). Frontend calls `logout()`
  right after a successful response.
- New Zod schemas: `updateMeSchema`, `changePasswordSchema`.

**Frontend (new components):**
- `ProfileHeader.tsx` — gradient cover banner, avatar (Cloudinary photo or
  gradient initial), verified/seller/admin badges, a 4-stat strip (Books
  Read, Active Rentals, Following, Reviews Given — Following/Reviews fetched
  live via `fetchFollowCounts`/`fetchMyStats`), and action buttons.
- `EditProfileModal.tsx` — avatar upload (reuses `uploadService.uploadImage`)
  with live preview, name field, saves via the new `updateMe` service call.
- `ChangePasswordForm.tsx` (Security tab) — current/new/confirm fields,
  client-side length + match checks, calls the new `changePasswordRequest`,
  then auto-logs-out ~1.5s after a success message.
- `Profile.tsx` rewritten around the 6 tabs from the plan; Orders tab adds an
  All/Rentals/Purchases filter (client-side on `order.items[].mode`); Overview
  keeps `ProfileStats` + the single most recent order + the sustainability
  panel.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean
  (backend: 0 errors, the same 5 pre-existing dev-tooling warnings).
- Backend Jest **43/43** (was 42, +1 rememberMe test); frontend Vitest
  **14/14**; frontend `vite build` succeeds.
- API-level smoke test against the live dev backend (Chrome automation
  wasn't available this session — extension not connected): registered a
  throwaway account, `PATCH /users/me` renamed it and the change persisted,
  `PATCH /auth/change-password` correctly 401'd on a wrong current password
  and succeeded on the right one, and confirmed login now rejects the old
  password and accepts the new one.
- Also fixed a stale `lookbook-backend/.env` `CLIENT_URL` (`5174`, a leftover
  from the 2026-08-28 port-collision note) that no longer matched this
  session's actual dev frontend port (`5173`) — updated so CORS doesn't
  silently block the app the way it did in that earlier incident.

### Feature 3 — Recharts Reading Dashboard
Replaced the plain-CSS reading dashboard's stat tiles with real Recharts
visualizations, per the plan (a prior session's 2026-08-18 entry had noted
Recharts wasn't installed and built a CSS-only heatmap instead — that
tradeoff is now resolved by actually installing the library).

**Backend** (`readingController.getReadingStats`):
- Added `monthlyBooks: {month, count}[]` — always exactly 12 entries (oldest
  to newest), counted from the same `finishedActivities` query already run
  for the streak/calendar fields, no extra DB round-trip.
- Added `genreBreakdown: {genre, count}[]` — full per-genre counts from order
  history (the existing `favouriteGenres` only kept the top-3 names with no
  counts, not enough to drive a pie chart).

**Frontend** (`ReadingDashboard.tsx`, `npm install recharts`):
- AreaChart — 90-day daily activity (reuses the same sparse `calendar` data
  as the heatmap, just flattened instead of gridded).
- BarChart — books finished per month.
- PieChart — genre breakdown with a color-coded legend.
- Kept the GitHub-style 90-day heatmap grid as-is underneath (plan explicitly
  says keep it — Recharts has no built-in heatmap primitive).
- All three charts use `ResponsiveContainer` so they scale on mobile without
  fixed pixel widths, per the plan.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean (one real typing
  fix needed: Recharts' `Tooltip formatter` prop type doesn't accept a plain
  `(value: number) => [string, string]` signature — dropped the custom
  formatter rather than fight the generic, default tooltip rendering is
  fine here). Both eslint clean.
- New backend test `readingStats.test.ts`: creates a real order across two
  genres, marks one book finished, and asserts `monthlyBooks` has exactly 12
  entries summing to 1, and `genreBreakdown` counts both genres correctly.
- Backend Jest **44/44** (was 43, +1); frontend Vitest **14/14** unchanged;
  `vite build` succeeds — the new `Profile` lazy chunk grew to ~123 kB gzip
  (Recharts itself), but since Profile is already its own `React.lazy`
  route chunk (per the 2026-08-18 bundle-audit work), the shared main bundle
  is untouched at 420 kB/132 kB gzip.
- No live browser check this session (Chrome extension not connected) —
  flagging for a manual visual check of the three charts rendering correctly
  once that's available.

### Feature 4 — Extend Rental UI
The plan called for a `GET .../extend-quote` dry-run endpoint if one didn't
already exist. It effectively already did: `POST
/orders/:id/items/:itemId/extend` (`orderController.extendRental`) computes
`extensionFee`/`extensionDays` and creates a Razorpay order, but a Razorpay
order is just a payment *intent* — no money moves until
`verifyExtensionPayment` checks a real signature. Confirmed this empirically
before building anything: called `extend` against a real order via the live
dev backend and checked the order's `dueDate` was untouched afterward. So
instead of adding a parallel non-charging endpoint, `OrderHistory.tsx`'s
existing extend flow (previously: click → immediately create the Razorpay
order → immediately open the payment widget) now splits into two steps:

- **`ExtendRentalModal.tsx`** (new) — shows the book title, the computed new
  due date (`currentDueDate + extensionDays`), and the prorated fee; Cancel
  or Confirm & Pay.
- **`OrderHistory.tsx`** — "Extend Rental" now calls `extendRental()` to get
  the quote and opens the modal; only on "Confirm & Pay" does it open the
  Razorpay widget with the already-created order and call
  `verifyExtensionPayment`. If the user cancels, the unused Razorpay order
  simply goes unconfirmed — same as an abandoned regular checkout.

**Verification:**
- Frontend `tsc -b` clean — one real fix needed: `Date.now()` inside the
  modal's render body tripped the `react-hooks/purity` eslint rule, so
  `currentDueDate` was made a required prop instead of falling back to
  "now" (every rent item always has a `dueDate` set at checkout, so the
  fallback was dead code anyway). Eslint clean.
- Live API smoke test against the dev backend: created a throwaway user +
  rented order directly in Mongo, called `POST .../extend` as that user,
  confirmed it returned `{extensionFee: 20, extensionDays: 7}` and a real
  Razorpay order id, and confirmed the order's `dueDate` was **unchanged**
  afterward — proving the quote step is genuinely side-effect-free before
  payment, exactly like the rest of the checkout flow.
- Backend Jest **44/44** unchanged (no backend code changed for this
  feature); frontend Vitest **14/14**; `vite build` succeeds.
- No live browser click-through of the Razorpay widget itself this session
  (Chrome extension not connected, and the project's own convention is to
  stop before entering real payment details anyway).

### Feature 5 — Pickup Scheduling UI
Confirmed first (per the note above) that the existing `Order.pickupSlot` is
a single free-text, order-level field set only by the admin tracking editor
— reusing it for buyer self-service would let an admin's manual entry and a
buyer's pick silently overwrite each other, and it can't represent more than
one item's pickup per order. Built separate **per-item** fields instead.

**Backend:**
- `Order.ts` — `IOrderItem` gains `pickupDate?: Date`, `pickupTimeSlot?:
  "morning"|"afternoon"|"evening"`, `pickupScheduledAt?: Date`. Deliberately
  named differently from the existing order-level `pickupSlot` so the two
  can never collide.
- `orderController.schedulePickup` — new `POST
  /orders/:id/items/:itemIndex/schedule-pickup`. Validates the slot is one
  of the three enum values and the date falls within today..+7 days, sets
  the three fields on that item, and fires an in-app notification (new
  `NotificationType`: `"order.pickupScheduled"`). No real courier API exists
  yet (Shiprocket needs credentials this environment doesn't have, same
  deferral as the admin tracking editor already documented) — this stores
  the request and notifies, matching that existing "record it, don't fake
  automation" pattern rather than pretending to dispatch a courier.
- `orderRoutes.ts` — wired the new route.

**Frontend:**
- `SchedulePickupModal.tsx` (new) — a 7-day date-chip row (skips Sundays,
  matching the plan) + morning/afternoon/evening slot buttons, `POST`s via
  the new `orderService.schedulePickup`.
- `OrderHistory.tsx` — active, un-returned rental items now show a "Schedule
  Pickup" link next to Extend/Report; once scheduled it's replaced with a
  read-only "Pickup [date] ([slot])" line pulled straight from the item.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean.
- New `schedulePickup.test.ts` (2 tests): a same-window date succeeds and
  round-trips the slot on the response, a 20-days-out date is rejected, and
  an invalid slot string is rejected. Backend Jest **46/46** (was 44, +2);
  frontend Vitest **14/14**; `vite build` succeeds.
- No live browser click-through this session (Chrome extension not
  connected) — the date-chip/slot picker's visual layout is unverified
  in-browser, flagging for a manual check.

### Feature 9 — Email Notification Preferences
**Backend:**
- `User.ts` — new `emailPreferences` embedded object (5 booleans, all
  default `true`, opt-out not opt-in). Verified with a dedicated test that
  Mongoose backfills the defaults on read even for a document saved *before*
  this field existed (simulated via a raw `$unset`) — matters because this
  ships against a live DB with real existing accounts, not a fresh seed.
- `userController.updateEmailPreferences` — new `PATCH
  /users/me/email-preferences`, merges a partial body into the existing
  preferences (Zod schema requires at least one key).
- `sanitizeUser` now includes `emailPreferences` so the frontend gets it for
  free on login/register/`/auth/me` without a separate fetch.
- `mailer.ts` — new `shouldSendEmail(userId, category)` gate. Wired into
  every category-mapped send site: seller approve/reject → `sellerNotifications`
  (`adminController.ts`), refund → `orderUpdates` (`adminController.ts`),
  order confirmation → `orderUpdates` (`orderController.ts`, checked inline
  off the already-loaded user doc rather than a second query), price-drop →
  `priceDropAlerts` (`bookController.ts`, filters the batch of wishlisters
  in one query instead of one `shouldSendEmail` call per user), rental due
  reminder → `rentalReminders` (`rentalReminderQueue.ts` — the in-app
  `notify()` still always fires; only the SMTP send is gated, matching the
  plan's "channels stay decoupled" existing design note). Verification-email,
  password-reset, and 2FA emails are **not** gated — security-critical,
  always send. `marketing` has no current sender (no newsletter feature
  exists) — the toggle exists for when one does, consistent with the
  project's pattern of building the setting ahead of the feature it'll gate.

**Frontend:**
- `NotificationsSection.tsx` (new, Security tab) — 5 toggle switches with
  optimistic UI (flips immediately, reverts on a failed PATCH). Deviated
  from the plan's "debounced 500ms" spec: a discrete toggle click isn't the
  kind of rapid-fire input debouncing exists for (unlike a text field), so
  each toggle saves immediately — debouncing would only have added a delay
  with no benefit here.
- `userService.updateEmailPreferences`; `EmailPreferences` type added to
  `User`.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean.
- New `emailPreferences.test.ts` (5 tests): defaults all-true on register,
  `PATCH` merges partial updates without clobbering untouched keys,
  `shouldSendEmail` correctly returns `false` only for the disabled category,
  an empty body is rejected, and the pre-existing-document backfill case
  above. Backend Jest **51/51** (was 46, +5); frontend Vitest **14/14**;
  `vite build` succeeds.
- No live browser check this session (Chrome extension not connected).

### Feature 10 — Club Shareable Invite Links
**Backend:**
- `Club.ts` — `inviteToken` (unique, sparse, `crypto.randomBytes(16)` schema
  default so every *newly created* club gets one automatically) and
  `inviteEnabled` (default `true`).
- Real edge case caught before it shipped: a schema `default` only fires at
  document *creation*, not on reading an existing document — so a club
  created before this migration would generate a fresh, unpersisted token on
  every read and never actually be findable by any token. Added
  `ensureInviteToken()`, called from `getClubs`/`getClubById`, which
  backfills and persists a token the first time an old club is read (a
  no-op once every club has a real stored one) — same self-healing pattern
  as the earlier ISBN partial-index fix, chosen over a one-off migration
  script since it needs no separate run step.
- `clubController.ts` — `getClubByInvite` (public, `GET
  /clubs/invite/:token`, only returns the join-preview shape: id/name/
  description/memberCount/book/owner.name), `joinByInvite` (`POST
  /clubs/invite/:token/join`, returns `{alreadyMember, club}` so the
  frontend can render the right state without a second request),
  `regenerateInvite` and `toggleInvite` (both owner/admin-only, matching the
  existing `isOwnerOrAdmin` check `updateClub`/`removeMember` already use).
- `clubRoutes.ts` — wired all four; `/invite/:token` sits structurally
  distinct from `/:id` (different segment count) so there's no route-order
  ambiguity to worry about.

**Frontend:**
- `ClubInvite.tsx` (new, `/clubs/join/:token`) — loading/not-found states,
  a join-preview card, and three outcomes: not logged in → sign-in button
  that redirects back to the same invite link after login (reuses `Login.tsx`'s
  existing `location.state.from` redirect, no changes needed there); logged
  in + not a member → Join button; already a member → "Go to Club".
- `ClubDetail.tsx` — new "Invite Members" section for the owner/admin: copy
  link, WhatsApp share (`wa.me` deep link), a QR code modal (`qrcode`
  library, generated client-side, no server round-trip), an enabled/disabled
  toggle, and Regenerate Link with an inline "this will break the old link"
  confirm step instead of a browser `confirm()` dialog.
- `Clubs.tsx` — a share icon on cards the current user owns, copies the
  invite link directly from the list view.
- The share link is built from `window.location.origin` at runtime, not a
  hardcoded domain — the plan's `lookbook.app` was a placeholder and the
  real deploy target is `lookbook-backend.onrender.com`; this way the link
  is always correct for wherever the frontend actually runs.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean.
- New `clubInvite.test.ts` (5 tests, matching the plan's named verification
  cases): two clubs get distinct tokens; the full preview→join→
  already-a-member round trip; an unknown token and a disabled link both
  404; regenerating invalidates the old token immediately; a non-owner
  member gets 403 on regenerate/toggle. Backend Jest **56/56** (was 51, +5);
  frontend Vitest **14/14**; `vite build` succeeds (`ClubDetail` chunk grew
  to include the `qrcode` lib, ~12 kB gzip, but it's already its own lazy
  route chunk so the shared bundle is untouched).
- No live browser check this session (Chrome extension not connected) — the
  QR modal, WhatsApp deep link, and copy-to-clipboard button are unverified
  in a real browser; flagging for a manual check.

### Feature 7 — Follow Feed Page
Confirmed first (per the note above) that `GET /follow/feed` already existed
but only returned reviews, unpaginated, with no activity merge and no
suggestions — extended it in place rather than adding a parallel endpoint.

**Backend (`followController.ts`):**
- `getFollowingFeed` now merges `Review` entries and `UserActivity`
  `action: "finished"` entries from followed users into one array (`{type:
  "review"|"activity", user, book, content?, rating?, action?, createdAt}`),
  sorted newest-first, with real `page`/`limit` query params (default 20,
  capped at 50) returned via `meta: {page, limit, hasMore}`. Since Mongo
  can't natively merge-sort two different collections in one query, it
  fetches a bounded window (`page × limit`) from each collection, merges in
  memory, then slices — cheap at this feed's realistic scale, and avoids
  either a fragile multi-collection aggregation or N+1 queries.
- New `getSuggestedUsers` (`GET /follow/suggestions`) — top reviewers by
  review count (aggregation on `Review`), excluding the current user, anyone
  already followed, and (respecting the existing privacy toggle) anyone
  without `publicProfile: true`.

**Frontend:**
- `Feed.tsx` (new, `/feed`) — review cards (star rating + excerpt + "View
  full review" link) and activity cards ("[Name] finished reading [Book]"),
  paginated with a "Load more" button, plus a "Who to Follow" sidebar with
  inline Follow buttons.
- `Navbar.tsx` — a Feed link (Rss icon) between the wishlist/cart icons and
  the notification bell, visible only when logged in (desktop + mobile menu).
- `followService.ts` — `fetchFollowingFeed(page, limit)` rewritten around
  the new paginated/typed response (the old unused single-shot version had
  no callers yet, so nothing else needed updating); new `fetchSuggestedUsers`.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean.
- New `followFeed.test.ts` (3 tests): a review + a finished-activity from a
  followed user merge correctly newest-first, `limit=1` correctly reports
  `hasMore: true`, an empty follow list returns an empty feed rather than
  erroring, and a separate suggestions test confirms a public-profile
  reviewer is suggested while a private-profile one and the viewer
  themselves are excluded. Backend Jest **59/59** (was 56, +3); frontend
  Vitest **14/14**; `vite build` succeeds.
- No live browser check this session (Chrome extension not connected).

### Feature 6 — Coupon System (final feature)
Full new build — nothing existed for this before. Followed the advisor
guidance from the start of this session: the usage-count increment lives
inside `finalizePaidOrder`'s existing idempotency gate, not as a separate
step, so a coupon can never be double-counted regardless of which
confirmation path (client verify-payment, webhook, or both) actually fires.

**Backend:**
- `Coupon.ts` (new model) — `code` (auto-uppercased, unique), `discountType`
  ("percent"|"flat"), `discountValue`, `minOrderValue`, `maxUses` (0 =
  unlimited), `usedCount`, `expiresAt`, `active`.
- `utils/coupon.ts` — `validateCouponForCart(code, cartTotal)`, one shared
  function used by **both** the standalone `/coupons/validate` preview and
  checkout itself, so the two can never compute a different discount for the
  same code. Percent discounts round to the nearest rupee; a flat discount
  is capped at the cart total so a coupon can never make an order negative.
- `couponController.ts` — admin CRUD (`listCoupons`, `createCoupon` —
  rejects a duplicate code with 409, `updateCoupon`, `deleteCoupon` — soft
  delete via `active: false`) plus the public-to-logged-in-users
  `validateCoupon`.
- `orderController.checkout` — accepts an optional `couponCode`; on an
  invalid/expired/exhausted/below-minimum code, checkout is rejected with a
  400 **before** any `Order` document or Razorpay/Stripe order is created
  (verified in a test — no orphaned pending order left behind). On a valid
  code, `discountAmount` is subtracted from the Razorpay/Stripe amount and
  both `couponCode` and `discountAmount` are stored on the `Order`.
- `orderController.finalizePaidOrder` — increments `coupon.usedCount` via
  `Coupon.updateOne({code}, {$inc: {usedCount: 1}})`, placed after the
  existing `if (order.paymentStatus === "paid") return;` guard so it can
  only ever run once per order no matter how many times this function is
  called.
- `Order.ts` — added `couponCode?: string` and `discountAmount: number`
  (default 0).
- Routes: admin CRUD wired into the existing `adminRoutes.ts` (already
  `protect + adminOnly` at the router level, matching every other admin
  resource in this file — no separate coupon-admin router needed); a new
  `couponRoutes.ts` mounted at `/coupons` for the one user-facing
  `POST /coupons/validate` (`protect` only).

**Frontend:**
- `couponService.ts` (new) — `validateCoupon` for the cart, plus admin CRUD
  calls.
- `CartSummary.tsx` — coupon code input + Apply button; on success shows a
  green "applied" chip with a discount line item and an adjusted total, with
  a ✕ to remove; on failure shows the server's exact reason (min order,
  expired, etc.). The applied code is threaded through to whichever checkout
  button is clicked (Razorpay, UPI, or Stripe) via a small prop-signature
  change (`onCheckout`/`onUpiCheckout`/`onStripeCheckout` now optionally
  take the coupon code) rather than lifting the whole coupon state up into
  `Cart.tsx`.
- `orderService.checkout` — third optional `couponCode` param, forwarded
  as-is.
- `AdminCoupons.tsx` (new, `/admin/coupons`) — stats bar (total/active/uses),
  create/edit form, and a table with edit/toggle-active/delete actions.
  Wired into `AdminLayout.tsx`'s sidebar nav.

**Verification:**
- Backend `tsc --noEmit` clean; frontend `tsc -b` clean; both eslint clean
  (one real fix: an admin-page data-fetch effect needed the same
  `react-hooks/set-state-in-effect` disable comment every other admin/list
  page in this codebase already uses).
- New `coupon.test.ts` (12 tests) covering exactly the plan's named
  verification case — expired, max-uses, inactive, below-minimum-order — plus
  percent-rounding, flat-capped-at-cart-total, case-insensitivity, the
  `/coupons/validate` endpoint, admin-only + duplicate-code enforcement,
  PATCH/DELETE, and two checkout-integration tests: an invalid coupon 400s
  *before* any order or payment-provider call, and a valid coupon correctly
  discounts the created order's `total` (Razorpay's order-creation network
  call mocked via `jest.spyOn(global, "fetch")`, since no other test in this
  suite hits a real payment provider and this one shouldn't be the first to
  make Jest depend on network access).
- Backend Jest **71/71** (was 59, +12); frontend Vitest **14/14**; `vite
  build` succeeds.
- Live-checked against the running dev backend too (not just Jest): an
  unknown coupon code on `/coupons/validate` returns the correct
  `{valid: false, ...}` shape, and an unknown club-invite token still 404s —
  both consistent with the Jest results.
- No live browser check this session (Chrome extension not connected) — the
  CartSummary coupon UI and AdminCoupons table are unverified visually;
  flagging for a manual check.

---

## ✅ Session Update — 2026-08-30: All 9 planned features complete (GitHub OAuth skipped per request)

This closes out the `implementation_plan.md` build started earlier the same
session (see the 9 entries directly above for full per-feature detail).
Summary of what shipped, in build order:

| # | Feature | Status |
|---|---|---|
| 1 | Remember Me | Already fully built — added the one missing test |
| 2 | GitHub OAuth UI | **Skipped per explicit user instruction** |
| 8 | Profile redesign (tabs) | Built |
| 3 | Recharts reading dashboard | Built |
| 4 | Extend Rental UI (quote modal) | Built |
| 5 | Pickup scheduling UI | Built |
| 9 | Email notification preferences | Built |
| 10 | Club shareable invite links | Built |
| 7 | Follow feed page | Built |
| 6 | Coupon system | Built |

**Cumulative verification across the whole session:**
- Backend Jest: **42 → 71** (29 new tests across 6 new test files, all
  passing).
- Frontend Vitest: **14/14** unchanged throughout (no existing frontend unit
  test surface was touched).
- Both apps' `tsc`/eslint stayed clean after every single feature landed —
  never batched fixes across features.
- `vite build` succeeds; new route-level lazy chunks added for `Feed`,
  `ClubInvite`, and `AdminCoupons` keep the shared main bundle at its
  pre-session size (~132 kB gzip).
- One real, unrelated bug found and fixed along the way: `lookbook-backend/
  .env`'s `CLIENT_URL` was stale (`5174`, a leftover from an earlier
  session's port-collision note) and no longer matched this session's
  actual frontend dev port (`5173`) — fixed so CORS doesn't silently block
  the app the way it did in the 2026-08-28 incident this project has
  documented before.

**What's still unverified:** live browser click-through of every new UI
(Chrome extension wasn't connected this session) — the charts on the Reading
tab, the pickup-scheduling date/slot picker, the club invite QR/WhatsApp
buttons, the coupon input on Cart, and the AdminCoupons table are all
API-level and Jest-verified but not yet visually confirmed in a real
browser. Recommend a manual pass through the "Manual browser checklist" in
`implementation_plan.md`'s Verification Plan section before considering this
fully done.

---

## ✉️ Session Update — 2026-08-28: Resolved "Please verify your email address" blocking listings/orders

User's account (`shaileshpratapsingh21@gmail.com`, a normal email/password
registration, not Google OAuth) had `emailVerified: false`, and
`requireVerifiedEmail` correctly 403's `POST /api/listings`,
`POST /api/listings/scan`, and checkout for any unverified account — the
error was a real gate working as designed, not a bug in the check itself.
The account never got verified because no verification email had actually
reached the user before this.

Root cause was the SMTP credentials/flow never having been exercised end to
end for this account. No code changes were needed — resolved by using the
existing "Resend email" button on the Profile page's verification banner
(`EmailVerificationBanner.tsx` → `POST /auth/resend-verification`) and
completing the real link. Verified in Chrome: clicked Resend, confirmed the
backend actually sent it (`POST /api/auth/resend-verification` 200 in ~2s —
a real SMTP round trip, not just the dev-mode console log), opened the
verification link, confirmed `POST /api/auth/verify-email` returned 200, and
the Profile page's "Please verify your email address" banner was gone on
reload. Re-checked the Sell page afterward — the form no longer blocks
submission on the email gate.

Note for future accounts hitting this: registering with email/password in
this dev environment (`NODE_ENV=development`) already auto-verifies on
signup (`authController.ts` register — `emailVerified = !env.isProd`), and
Google OAuth accounts are created pre-verified too
(`oauthController.ts:62`). This account predates that dev auto-verify
behavior (or was otherwise never completed), which is why it alone needed
the manual resend+click. Any *new* account should not hit this at all; an
existing stuck one can always self-resolve via Resend on the Profile page.

---

## 📷 Session Update — 2026-08-28: Sell-book photo upload fixed (stale Cloudinary/Groq credentials)

User reported being unable to upload a book via the Sell page. Root cause
wasn't code — it was a **stale running process**: the user regenerated the
Groq API key and fixed the Cloudinary `cloud_name` in `.env`, but the backend
had been started (13:05) before that edit (19:02) and `dotenv` only reads
`.env` once at process start, so it was still holding the old, invalid
credentials in memory. Editing `.env` alone never restarts a running Node
process, and this instance wasn't running under a live nodemon watch (a
touched/edited watched `.ts` file didn't trigger a restart either) — so it
needed a manual restart.

- Killed the stale nodemon/ts-node process tree and restarted `npm run dev`
  fresh, confirmed via the startup log (`[db] MongoDB connected`, `server
  started`) and `/health` returning 200 on the new process.
- **User confirmed live**: book upload on the Sell page now works.

No application code changed — this was purely a stale-credentials-in-memory
issue. Worth remembering for future sessions: after editing backend `.env`,
the dev server must be restarted (not just have the file saved) before the
new values take effect.

---

## 🎨 Session Update — 2026-08-28: Redesigned the Popular Categories fallback icons

`PopularCategories.tsx`'s category cards fall back to a placeholder whenever
`category.image` is null (currently every category, since cover art was
cleared in the 2026-08-18 hotfix). The first fallback — a single flat Lucide
icon centered in an amber gradient box — was rejected as not visually strong
enough ("switch them with the earlier icons... that one looks too good than
this," then "just change the icons into something beautiful").

Replaced it with `BookStack`, a small fanned stack of 3 book spines (styled
after the 📚 emoji already used in `Hero.tsx`'s "50,000+ Books" badge) —
3 rotated spine rectangles per card, with the center spine carrying a small
genre icon. Each genre gets its own 3-shade color theme instead of one shared
amber gradient:
- Business → indigo, Fiction → fuchsia, History → amber, Romance → rose,
  Science → teal, Self Help → emerald, unmapped genres → slate (`Compass` icon).

Verified: `npx tsc -b` and `npm run lint` both clean; confirmed live in Chrome
(with a service-worker unregister + cache clear first) — all 6 category cards
render distinct, correctly colored fanned book-stacks.

---

## 🔌 Session Update — 2026-08-28: Root-caused the recurring Atlas "SSL alert number 80" — it's the IP allowlist, not TLS

Reported as a **Google login failure**. It wasn't an OAuth bug: the request
reached `User.findOne` inside `findOrCreateOAuthUser`, meaning Google had
already returned a profile successfully. The failure was the database call.

### Root cause (finally pinned down)
The `MongoServerSelectionError: ... SSL alert number 80` that this project
has hit repeatedly — and that earlier entries described as "flaky Atlas TLS"
— is **Atlas rejecting a non-allowlisted IP**. The driver surfaces the
refused TLS handshake instead of the real reason, which is why it kept
reading like a transport/certificate fault. Confirmed by forcing a longer
selection timeout and reading the full driver message: *"Could not connect to
any servers... Make sure your current IP address is on your Atlas cluster's
IP whitelist."*

The dev machine has a **dynamic public IP**, so it drifts and silently breaks
a setup that worked the day before:
- allowlisted 2026-08-18: `152.59.184.36`
- actual IP 2026-08-28: `152.59.185.197`

This also retroactively explains the "~50% of *fresh* connections drop" note
in `phase-13-status.md` §13.6 — established connections kept working while
new ones were refused.

**Resolution is user-side** (needs Atlas console access): add the current IP
under Atlas → Network Access, or use a `0.0.0.0/0` rule for a dev cluster.

### Code changes (reliability, not the fix itself)
- `config/db.ts` no longer `process.exit(1)`s on the first failed handshake —
  that's why nodemon kept reporting "app crashed" whenever the IP drifted.
  Now retries 5× with exponential backoff (2s→15s) before giving up.
- Added `disconnected` / `reconnected` / `error` connection logging, so a
  mid-run drop is visible instead of only showing up as requests that hang.
- `serverSelectionTimeoutMS: 10000` (down from the 30s default) so a
  known-bad connection fails fast and retries rather than stalling callers.
- On a matching error, the log now prints a direct hint naming the IP
  allowlist as the likely cause — the whole point being that the next person
  to hit this shouldn't have to re-derive it from a misleading TLS message.

### Tried and deliberately reverted
`family: 4` (force IPv4) is the standard remedy for this error signature, so
it was added first — then **A/B tested against the default before keeping
it**. Both variants failed identically (~10s), so it was removed rather than
left in as a cargo-cult "fix" that would have taken credit once the real
allowlist issue was resolved.

### Verification
`tsc` clean; eslint 0 errors (5 pre-existing warnings). The connection itself
can't be verified green until the IP is allowlisted — `/health` returns 200
(it doesn't touch Mongo) while every DB-backed route times out, which is
itself the clearest confirmation of the diagnosis.

---

---

## 💅 Session Update — 2026-08-28: Auth page UX — GitHub OAuth removed, password reveal, email placeholder

User-requested changes to the login and signup pages.

- **Removed the "Continue/Sign up with GitHub" option** from `Login.tsx` and
  `Register.tsx` (buttons + now-unused `GithubIcon` imports). Google OAuth is
  untouched. The backend `/auth/github` route and `oauthUrls.github` constant
  were deliberately left in place — only the UI option was asked for, and the
  route is harmless dead weight rather than something to rip out unasked.
  (`GithubIcon` itself stays exported in `SocialIcons.tsx` — nothing imports
  it now so it tree-shakes out, and it's there if GitHub login is re-added.)
- **Password reveal toggle** — implemented once in
  `components/auth/FormField.tsx` rather than per-page, so every password
  input gets it consistently: Login, Register, *and* Reset Password. Renders
  an Eye/EyeOff button inside the field, `type="button"` so it never submits
  the form, with `aria-label` ("Show password"/"Hide password") and
  `aria-pressed` for screen readers. Input gets `pr-12` so text never runs
  under the icon.
- **Email placeholder** changed from `you@example.com` to
  `enter email address`.

### Note on scope
The same `you@example.com` placeholder also appeared on the **Forgot
Password** page. The request named login/signup specifically, but leaving one
email field inconsistent would look like an oversight, so that one was
changed too — trivially revertible if it wasn't wanted.

### Verification
`tsc` clean, eslint clean, frontend Vitest 14/14. Verified live in Chrome on
both pages: GitHub button gone, placeholder correct, and the reveal toggle
actually switches the field to plain text (typed value rendered visibly) and
back. No e2e specs referenced the removed GitHub button.

---

---

## 🔧 Session Update — 2026-08-28: A.4/A.5/A.6 verified in Chrome — 3 real bugs found & fixed

Live browser audit of the Admin Portal (A.4), Seller Portal (A.5), and
Community (A.6) sections. Three genuine bugs found — two of which made
documented features **completely unusable** rather than merely cosmetic.

### Bug 1 — Admin book import was permanently broken (Open Library timeout)
`utils/openLibraryApi.ts` aborted every Open Library call after **5s**, but
the API measurably takes 6–12s from this network. Every admin
"Import Books From API" search failed with "Couldn't search the books API",
making the entire A.4 Open-Library import panel unusable.
- Raised the user-initiated lookup budget to 20s (`LOOKUP_TIMEOUT_MS`) and
  kept a shorter 8s budget for the optional background description fetch,
  where abandoning a slow call is genuinely correct.
- Also fixed a real diagnostic blind spot: `bookImportController` caught the
  failure with a bare `catch {}`, discarding the cause — a genuine outage, a
  timeout, and a rate-limit were indistinguishable. Now logged via `pino`.
- **Verified in Chrome:** search for "stoicism" returns 24 real results with
  covers, authors, and selectable checkboxes.

### Bug 2 — Seller listings without an ISBN could never be approved
Approving a sell listing creates a `Book`. The live `books` collection had a
legacy **plain-unique** `isbn_1` index (no sparse/partial filter), so MongoDB
indexed every ISBN-less book under the key `null` — the *second* such book
always collided with `E11000 duplicate key`, surfacing in the admin UI as a
silent **409**. Since most seller listings have no ISBN, this blocked the
core A.5 seller flow entirely.
- The schema already declared `sparse: true`, but (a) Mongoose never alters
  an existing index, so the stale one persisted, and (b) `sparse` only skips
  *absent* fields — an explicit `isbn: null` is still indexed. Replaced with
  a **partial** index scoped to real strings
  (`partialFilterExpression: { isbn: { $type: "string" } }`), which handles
  both cases.
- Added `src/scripts/fixIsbnIndex.ts` — an index-only migration (drops the
  legacy index, clears explicit-null ISBNs, creates the partial index). Run
  against the live DB; no book documents removed.
- **Verified end-to-end in Chrome:** created a listing as a normal user →
  approved it as admin → linked `Book` created → user auto-promoted to
  `isSeller: true` → Seller Dashboard renders the approved listing.

### Bug 3 — Joining/leaving a club blanked out the owner name
`joinClub`, `leaveClub`, and `createClub` returned **unpopulated** documents
while `getClubById`/`updateClub` populated `owner`/`members`/`book`. After
joining a club the UI re-rendered "owned by UI Test User" as "owned by "
(bare ObjectId). This is the same defect class the docs say was already
fixed for order mutations — the club controller was missed.
- Extracted a shared `populateClub()` helper and applied it to all three
  mutations (also de-duplicating two inline copies in `updateClub`/
  `removeMember`).
- **Verified in Chrome:** leave → rejoin now keeps the owner name rendered.

### Verified working, no changes needed
- **A.4:** dashboard metrics (₹318 revenue / 18 orders / 89 users / 185
  books), book CRUD + CSV import + smart-pricing toggles, seller approvals,
  listing moderation (Pending/Approved/Rejected), order management with
  populated buyer names (the documented "Unknown ()" fix holds), user
  search/suspend/activity, payouts queue, audit log (correctly captured this
  session's `order.updateTracking` action), and the §13.1 A/B analytics panel
  with z-tests.
- **A.5:** all 5 seller tabs — Listings, Inventory, Orders, Revenue (10%
  commission labelled "illustrative", gross/commission/net/withdrawable +
  payout request & history), Performance (views→wishlists→purchases funnel).
- **A.6:** clubs list, club detail, join/leave, thread creation, comment
  posting with author attribution and delete controls, reading challenges
  with progress bar + leaderboard. Confirmed a *non*-bug: challenge progress
  showed 0/1 because the seeded "1 Book Sprint" period is July 2026 while the
  test activity is August — the live progress query is correct.

### Verification
Backend Jest **42/42**; frontend Vitest 14/14; `tsc` clean on both apps;
eslint 0 errors (5 pre-existing warnings).

---

---

## 🐛 Session Update — 2026-08-28: Browser re-test of A.1/A.2/A.3 — homepage duplicate-key bug found & fixed

User asked for A.1–A.3 to be re-tested specifically **in Chrome** after the
earlier API-level audits. That was the right call: browser testing surfaced a
real rendering bug that the API-level checks had missed entirely.

### The bug
The homepage's **Continue Reading** and **Recently Viewed** sections built
their lists straight from order/activity history with no dedup:
- `continueReading` flat-mapped rental items across *all* orders — so a book
  rented in 3 separate orders appeared 3 times. It also never filtered out
  already-returned rentals, contradicting the section's own documented intent
  ("active rentals not yet marked returned").
- `recentlyViewed` mapped raw `UserActivity` view rows — and viewing a book
  more than once logs a fresh row each time, so the same book repeated
  before any distinct title appeared.

Because both lists key on book id, React logged
`Encountered two children with the same key` (35 occurrences in one session)
and the affected carousels rendered corrupted — visible in the browser as a
large blank gap mid-page. Confirmed against live data: `recentlyViewed`
returned `[A, A, B, B, B]` and `continueReading` returned `[B, B, B]`.

### The fix
- New `utils/dedupeById.ts` — dedupes by `.id`, keeping first occurrence and
  preserving order. `id` is treated as optional since it's a Mongoose virtual;
  entries without one are dropped rather than collapsed together under a
  shared `undefined` key.
- `homepageController.ts` — both sections now dedupe, and `continueReading`
  additionally filters out returned rentals.
- `__tests__/dedupeById.test.ts` — 6 tests incl. the exact real-world case.
  Backend suite now **42/42** (was 36/36).

### Verified in Chrome
After the fix: `recentlyViewed` shows 3 distinct books, `continueReading`
shows 1, the blank-gap corruption is gone, and a fresh page load produces
**zero** duplicate-key console errors (previously 35).

### Also confirmed working in-browser (no changes needed)
Homepage personalized sections render with correct explainability badges
("For You", "Trending in Fiction", "Similar to your recent reads",
"Because You Read Deep Work") — A.1.2's documented behavior, visually
confirmed rather than just API-checked.

---

---

## ✅ Session Update — 2026-08-28: A.3 (AI Features Architecture) verified live — clean, no gaps

Continued the section-by-section live audit of `UPDATED_FUTURE.md` Part A
(after A.1/A.2, see entries below). Checked all 8 AI-feature subsections
against real code and live API calls. Unlike A.2 (2 real gaps) and A.12
(dark mode, false claim), **A.3 checked out clean across the board** — no
code changes made.

- **3.1 AI OCR Book Upload**: `bookScanController.ts` matches the doc
  precisely — vision extraction → ISBN cross-check against own catalog +
  Open Library → price prediction (with a rule-based fallback when no AI
  key is configured, a nice touch the doc doesn't even mention) → seller
  always confirms before publishing.
- **3.2 AI Search & Recommendation**: live-tested with a real constrained
  query (`"science fiction under 300 rupees"`) — correctly parsed to
  `{maxPrice: 300, keywords: ["science fiction"]}` and returned 12 genuinely
  relevant, correctly-priced results. One minor doc inaccuracy: the taste
  vector is documented as "recomputed on a schedule" but is actually
  computed lazily on cache-miss (`homepageController.ts`) — not worth
  "fixing" since that already achieves the same freshness goal via the
  cache-invalidation-on-activity mechanism verified in the A.1.2 entry
  below, and a redundant scheduled job would add complexity for no benefit.
- **3.3 AI Chat Assistant**: confirmed exactly 3 tools exist
  (`searchBooks`/`getOrderStatus`/`getActiveRentals`), all read-only — the
  doc's "no state-changing tool exposed" guardrail claim is accurate,
  verified by checking there's nothing else to find.
- **3.4 AI Book Summary**: confirmed computed on both real paths (admin book
  creation, seller listing approval), served from `Book.aiSummary`
  thereafter (not regenerated per view). Live-checked the real shape on
  "Deep Work" — matches the documented fields exactly.
- **3.5 AI Review Analysis**: live-checked on "Atomic Habits" (19 real
  reviews) — `positivePercent`, `commonPros`, `commonCons`, `emotionalTone`
  all present and sensible, plus `reviewCountAtGeneration` for staleness
  tracking (an extra the doc doesn't mention).
- **3.6 AI Duplicate Listing Detection**: `duplicateFlag`/`duplicateCandidate`/
  `duplicateReason` on `Listing` confirmed real, admin-review-only (no
  auto-merge/auto-reject path exists).
- **3.7 AI Cover Quality Check**: `uploadController.ts`'s `checkCoverQuality`
  confirmed real — runs before Cloudinary upload, degrades to
  accept-by-default when no AI key is configured.
- **3.8 Voice Search**: confirmed both paths — client-side Web Speech API in
  `SearchBar.tsx`, and the backend Whisper-via-Groq transcribe endpoint with
  a Gemini fallback.

No code changes from this entry — reported as a clean pass.

---

---

## 🛠️ Session Update — 2026-08-28: A.1.4/A.1.5/A.2.1-2.3 verified live — 2 real gaps found and built

Continued the section-by-section live audit of `UPDATED_FUTURE.md` Part A
started with A.1.1–A.1.3 earlier the same session (see entry below). This
entry covers A.1.4/A.1.5 and all of A.2. Same discipline throughout: live
API/browser tests, not just reading the doc, since Part A already had one
confirmed false claim (dark mode, logged separately).

### A.1.4 — Reading Dashboard: real gap found and built
`getReadingStats` correctly computes books-read, money-saved, streak, and a
90-day `calendar` array — but `ReadingDashboard.tsx` never rendered the
calendar at all, despite the doc's explicit "backs the streak counter and
calendar heatmap" claim. Built a GitHub-style 90-day contribution grid
(`ReadingDashboard.tsx`, plain CSS — no new charting dependency, matching
the doc's Recharts claim being wrong too: recharts isn't even installed).
Verified live: marked a book "finished" via the API, confirmed the cell lit
up on the real profile page.

### A.1.5 — Sustainability Dashboard: verified accurate, no changes
`SustainabilityDashboard.tsx` matches the doc exactly — aggregate rental
counts against documented conversion constants, assumptions shown openly on
the page. Nothing to build.

### A.2.1 — Payments: verified accurate, no changes
Live-confirmed `GET /api/config` capability flags (Razorpay available,
Stripe correctly reported unavailable), the pending-order-then-webhook flow
(re-confirmed from yesterday's live checkout test), and the UPI-scoped
Razorpay checkout block (`utils/razorpayCheckout.ts`) exactly as documented.

### A.2.2 — Rentals: real gap found and built
`Order.lateFee` existed as a schema field, `RENTAL_LATE_FEE_PER_DAY` existed
as a config value, and the frontend type had the field — but **nothing in
the codebase ever computed it**. The doc's "Late-fee sweep... implemented"
claim was false. Built:
- `utils/lateFee.ts` — `overdueDays`/`calculateLateFee` (per-day rate ×
  overdue days × quantity, floors partial days, freezes at the return date
  so a later sweep can't inflate an already-returned item's fee).
- Wired into `returnItem` (finalizes the fee at return) and a new sweep
  added to the existing `rentalReminderQueue` worker (recomputes — never
  increments — so a missed/repeated run can't double-charge).
- `OrderHistory.tsx` now shows the fee when non-zero.
- `__tests__/lateFee.test.ts` — 10 tests covering the edge cases above;
  backend suite now 36/36 (was 26/26).

### A.2.3 — Delivery: real gap found and built
The admin tracking editor (`PATCH /admin/orders/:id/tracking`) was real and
correct — but the doc's claim "Tracking is shown to the buyer on their
Profile" was false; `OrderHistory.tsx` never rendered any tracking field.
Built the buyer-facing tracking block (carrier, status, tracking number +
link, pickup slot) in `OrderHistory.tsx`. Verified live end-to-end: admin
set tracking via the API, buyer's real profile page rendered it correctly
("In Transit · BlueDart", clickable tracking link, pickup slot).

### Also found (environment, not a code bug)
Mid-session, the browser briefly showed the old hardcoded "3 Reviews Given"
and a dark-mode-looking profile page again, despite both being fixed and
confirmed live yesterday. Root cause: the PWA service worker (`sw.js`,
registered unconditionally in `main.tsx` for offline-shell caching) was
serving a stale cached bundle from before those fixes — a normal
Ctrl+Shift+R hard reload doesn't bust a service-worker-controlled cache.
Unregistering the SW and clearing caches resolved it immediately; not a
regression in either fix. Worth knowing for future dev sessions in this
project — a stale-looking page after a real code change may need the
service worker cleared, not just a hard reload.

### Verification
Backend Jest **36/36** (10 new); frontend Vitest 14/14 (unchanged, no
frontend logic tests touched); `tsc`/eslint clean on both apps.

---

## ✅ Session Update — 2026-08-28: A.1.1–A.1.3 live-verified — no gaps, nothing to build

User-directed live audit of `UPDATED_FUTURE.md`'s Authentication (§1.1),
Personalization (§1.2), and Roles & Dashboards (§1.3) sections — same
live-test discipline as the rest of this session, not just re-reading the
doc. Unlike dark mode (A.12, found false) and the two gaps found later the
same session (A.2.2 late fees, A.2.3 tracking display), these three checked
out as genuinely accurate:

- **A.1.1**: live-tested the full 2FA cycle end-to-end (setup → real TOTP
  code via `otplib` → confirm → login → challenge-token exchange →
  confirmed the challenge token is correctly rejected as a Bearer access
  token → disable), confirmed refresh-token rotation uses a real atomic
  `findOneAndUpdate`, and confirmed the CSRF cookie path is the fixed `/`
  (not the old buggy `/api/auth` scoping). One minor doc inaccuracy noted:
  `requireVerifiedEmail` is documented as gating only checkout, but it's
  also applied to 3 listing/selling routes — functionally correct, just an
  incomplete doc description.
- **A.1.2**: live-tested the specific "cache invalidation on activity" claim
  — fetched the homepage (cached), viewed a book to trigger `logActivity`,
  re-fetched, confirmed the cache was actually busted rather than serving a
  stale snapshot. All 7 documented homepage sections present and correctly
  structured in the real API response.
- **A.1.3**: confirmed `role`/`isSeller` are independent fields, backend
  `adminOnly`/`sellerOnly` middleware exist, frontend guards (`AdminLayout.tsx`,
  `SellerDashboard.tsx`) redirect correctly, and listing approval genuinely
  sets `isSeller: true` atomically alongside creating the seller's book.

No code changes from this entry — reported as a clean pass rather than
manufacturing busywork.

---

---

## 🐛 Session Update — 2026-08-28: Live Chrome testing — 4 real bugs found, 3 fixed

Tested the running app end-to-end with Claude in Chrome (not code reading —
actual clicks, network/console inspection) rather than continuing the
document-verification pattern from the prior sessions. Found 4 real, distinct
bugs; fixed 3.

### Found & fixed

1. **CORS blocked every API call** — `lookbook-backend/.env`'s `CLIENT_URL`
   was hardcoded to `http://localhost:5173`, but Vite silently landed the
   frontend on `5174` because another local project already held 5173. The
   backend's CORS middleware only ever echoes back the configured origin, so
   the browser silently blocked every API response — pages rendered empty
   with no console error explaining why. Fixed: `.env` updated to `5174`,
   backend restarted, confirmed live.
2. **Dark mode was a non-functional stub** — the toggle correctly detected
   OS dark-mode preference and applied `<html class="dark">`, but a survey
   found ~700+ hardcoded Tailwind color classes across the app with no shared
   theme tokens; only one hand-written CSS block (`index.css`, attribute
   selectors like `[class*="bg-white"]`) partially reskinned a few of them —
   arbitrary-value classes like the homepage hero's `bg-[#F5F2EA]` were never
   covered. Given the scope (verified with the user rather than guessed), the
   agreed fix was to disable the feature rather than attempt a blind
   mechanical pass across hundreds of untested class combinations: removed
   the toggle button (`Navbar.tsx`), deleted `ThemeContext.tsx` and its
   `ThemeProvider` wrapper (`main.tsx`, now also clears any stale `dark`
   class/localStorage value from before this fix), removed the now-dead
   partial dark-mode CSS block, and deleted the Playwright test that
   exercised the removed toggle. Full dark-mode support is a separate future
   task, not attempted here.
3. **Raw internal errors leaked to the UI** — `errorHandler.ts`'s fallback
   branch sent `err.message` verbatim to the client for any unrecognized
   error type. Seen live: a `MongoServerSelectionError` (transient Atlas
   connectivity) rendered its raw message — including a Windows OpenSSL
   build file path — directly in the registration form. Fixed: unrecognized
   errors now always get the generic message; the existing dev-only `stack`
   field already covers debugging needs, and full detail is still logged
   server-side via the line just above.
4. **`ProfileStats.tsx` hardcoded "Reviews Given" to `3`** for every user,
   the only one of four profile stats not wired to real data — contradicts
   the project's own "no mock data" principle. Fixed: added
   `GET /api/users/me/stats` (`userController.ts:getMyStats`, real
   `Review.countDocuments({user: req.user.id})`), a matching
   `fetchMyStats()` in `userService.ts`, and wired it through `Profile.tsx`.
   Verified live: a fresh account correctly shows `0`, not `3`.

### Found, not fixed (flagged for the user)

- None outstanding from this pass — all 4 findings from the Chrome session
  are resolved (bug 1 was fixed immediately on discovery; bugs 2–4 fixed on
  request).

### Verification

- Backend Jest **26/26**; frontend Vitest **14/14**; `tsc`/eslint clean on
  both apps (backend: 0 errors, 5 pre-existing warnings, unchanged).
- Live in Chrome: registration → onboarding → personalized homepage → book
  detail → rent-to-cart → checkout (reaches the real Razorpay widget in
  **Test Mode**, correctly stopped there rather than entering payment
  details) → profile all verified working. Toggle removal and the real
  review count both confirmed visually after a hard reload.
- Also confirmed live (unrelated to the 4 bugs, just a note for future
  sessions): the categories/browse page and registration both hit the
  documented Atlas TLS flakiness mid-session; resolved when the user
  re-whitelisted their current IP in Atlas Network Access. Not a code issue.

---

## 🚢 Session Update — 2026-08-27: §13.5 Deployment & Reproducibility — CI/Docker verified as far as possible without real infra

Picked up Phase 13 at §13.5, the last unstarted track. No Docker daemon or
git remote exists in this environment (unchanged from 2026-08-18) — the
user will deploy separately later, so this session didn't attempt to stand
up Docker or a remote. Instead did the closest available substitute for
"verify Docker + CI on real infra":

- **Both Dockerfiles + `.dockerignore` files reviewed line-by-line** —
  backend's build-stage output path matches `tsconfig.json`'s `outDir` and
  the final `CMD` matches the `start` script; frontend's nginx stage has a
  correct SPA `try_files` fallback; both `.dockerignore`s correctly exclude
  `.env`, so there's no secrets-leak risk into a Docker build layer.
- **Every step of `.github/workflows/ci.yml` run locally**, exactly as
  written (skipped only `npm ci` itself, to avoid wiping `node_modules` out
  from under the currently-running dev servers): backend lint/tsc/test and
  frontend lint/tsc/test **all pass** — backend Jest 26/26, frontend Vitest
  14/14, no lint errors, clean typechecks on both. This confirms the CI
  workflow is actually correct, not just present; the only remaining gap to
  "done" is a git remote to push to and trigger it for real.
- Confirmed backend tests need **no CI secrets or service containers** —
  `globalSetup.ts` spins up `mongodb-memory-server` and explicitly zeroes
  `REDIS_URL` before any test runs.
- **`setup-from-scratch.md`** — `npm run seed`'s documented behavior
  verified against `seed.ts` source; updated its stale §5 (Lighthouse was
  listed "pending" but is now done per the §13.2 work).
- **Seed-data versioning** — re-ran `npm run export:dataset` live
  (read-only, safe): 185 books/99 interactions/28 users, still works.

### Docs updated
- `lookbook-backend/docs/setup-from-scratch.md` — §5 rewritten.
- `lookbook-backend/docs/phase-13-status.md` — §13.5 table updated, new
  2026-08-27 section added.

---

## 📐 Session Update — 2026-08-27: §13.4 Architecture Docs re-verified — found and fixed real drift in 3 of 4

Picked up Phase 13 at §13.4, the next track after §13.3. Unlike §13.3 (which
held up unchanged), this pass found genuine documentation drift in the ER
diagram, the architecture doc, and the checkout sequence diagram — each
checked against the actual code rather than assumed accurate.

- **ER diagram** — cross-checked all 22 Mongoose model files. `Plan` and
  `Shelf` are real standalone collections that were missing entirely from
  the diagram; conversely `WISHLIST_ITEM`, `MEMBERSHIP`, and `ADMIN_USER`
  were drawn as separate collections when they're actually embedded arrays
  on `User`/`Club` and a `role` value on `User`. Both classes of error fixed.
- **Architecture doc** — corrected "React 18" → 19 (`package.json`), and
  removed a described `safeCache` in-memory-fallback + "TTL jitter" caching
  mechanism that doesn't exist anywhere in the code — the real
  `config/redis.ts` is a simple try/catch wrapper that falls through to a
  live recompute when Redis is unreachable, nothing more.
- **Checkout sequence diagram** — the existing diagram showed a single
  synchronous checkout call decrementing stock inline. The real code
  (`orderController.ts`) deliberately splits order creation from payment
  confirmation across two paths — the client-side `verify-payment` call and
  the Razorpay/Stripe webhook — both converging on one idempotent
  `finalizePaidOrder` (explicitly commented in source: "never trust a
  client 'it succeeded' claim"). Rewritten to show the real split, including
  the webhook confirmation path the roadmap specifically asked for that no
  existing diagram had; noted that the webhook path is unexercised in this
  environment since the providers can't reach `localhost`.
- **AI-search/recommendation sequence diagrams and the design-decision
  log** — checked against `aiSearchController.ts`/`homepageController.ts`
  and re-read in full respectively; both hold up unchanged.

### Docs updated
- `lookbook-backend/docs/thesis/er-diagram.md`,
  `docs/thesis/architecture.md`, `docs/thesis/sequence-diagrams.md` —
  corrections applied with 2026-08-27 change notes so the fixes don't
  silently drift back.
- `lookbook-backend/docs/phase-13-status.md` — §13.4 table updated, new
  2026-08-27 section added.

---

## 🔒 Session Update — 2026-08-27: §13.3 Security Review re-verified live

Picked up Phase 13 at §13.3, the next track after §13.2. All three items
were already marked ✅ from 2026-08-18, so rather than trust that at face
value (the §13.2 pass the same day found "built"/"done" benchmark work that
had never actually run), each claim was re-checked against the live app.

- **Dependency audit** — re-ran `npm audit --json` on both apps: backend 2
  high (dev-only, eslint toolchain), frontend 0 vulnerabilities — identical
  to the 2026-08-18 numbers, no drift in 9 days.
- **Secrets hygiene** — re-scanned all backend/frontend source for
  hardcoded-credential patterns (AWS/Google/Groq/Stripe/Razorpay keys,
  private-key blocks, live Mongo connection strings) — none found;
  `.env.example` re-read end to end, still all placeholders;
  `docker-compose.yml` references `.env` via `env_file:`, no inline secrets.
- **OWASP checklist** — spot-verified 4 claims empirically instead of just
  re-reading the table: raw-body preservation for Razorpay/Stripe HMAC
  verification is correct (the common re-serialization bug that silently
  breaks signature checks is not present); `sanitizeUser` allowlists fields
  rather than spreading the raw `User` doc; CSRF + rate-limit middleware are
  actually wired into routes; and — the one live traffic test — 25 rapid
  `POST /api/auth/login` requests came back `401` ×20 then `429` from
  request 21, confirming the auth rate limiter fires for real, not just in
  code.

All three items hold up unchanged; no new vulnerabilities or secrets found.
The doc's pre-existing "Open items" (an eslint-toolchain major bump to clear
the last 2 dev-only high vulns, fuzz-testing the image-upload gate and CSV
importer, stricter webhook content-type assertion) remain open — surfaced to
the user rather than acted on unilaterally, since bumping the toolchain was
explicitly called out as a separate, risk-controlled decision.

### Docs updated
- `lookbook-backend/docs/thesis/dependency-audit.md`,
  `docs/thesis/owasp-checklist.md` — re-verification dates and evidence added.
- `lookbook-backend/docs/phase-13-status.md` — §13.3 table updated, new
  2026-08-27 section added.

---

## 🧪 Session Update — 2026-08-27: §13.2 Performance & Load Testing run live + 3 benchmark/load-test tooling bugs fixed

Picked up Phase 13 at §13.2 (the next unstarted track after §13.1). The
benchmark/k6 scripts already existed (built 2026-08-18) but had never
actually produced a real measurement — every one of them silently failed or
measured the wrong thing. Full write-up: `lookbook-backend/docs/thesis/
performance-load-testing.md`.

### Tooling bugs found & fixed
- `src/scripts/benchmark/vectorLatency.ts` — the latency-measuring function
  queried a Mongoose model bound to the default (never-opened) connection
  instead of the one actually seeded with data; every run failed after
  seeding with a 10s buffering timeout. Fixed to use the connected model.
- `benchmarks/k6/book-search.js` — used `URLSearchParams`, which doesn't
  exist in k6's JS runtime; every iteration threw before sending a request,
  yet the threshold report still showed "passing" (0 requests, 0 errors).
  Fixed with a manual query-string builder.
- `benchmarks/k6/chat.js` — posted `{message, history}`; the real endpoint
  expects `{messages: [{role, content}]}`. Every request 400'd in ~5ms,
  fast enough to look like a working (if unlucky) benchmark run instead of a
  request that never reached the chat path. Fixed to match the real contract.

### What was actually measured (live, against Atlas + Redis Cloud)
- **Query-plan analysis** — re-confirmed all 9 real query shapes hit an index
  (IXSCAN), no COLLSCANs.
- **Vector-search latency** — 1k synthetic catalog: p50 2.16s / p95 5.46s /
  p99 12.83s (in-process cosine-similarity fallback, which re-fetches every
  embedded candidate on every query — confirms the roadmap's predicted
  scaling concern). 10k/50k blocked: a 10k-doc seed hung 20+ minutes with no
  progress and was stopped — consistent with the already-documented Atlas
  TLS flakiness extending to bulk writes.
- **k6 load tests, all 4 core paths** — book search (20 VUs: avg 2.08s, p95
  2.88s, 0 errors), AI search (5 VUs: avg 11.37s, expected — includes
  LLM query-parse), checkout write path (5 VUs: avg 106ms, fast 400s on
  unverified email), chat assistant (3 VUs: mixed 200/429, rate limiter
  working as designed).
- **Headline finding**: `/api/books` averages 270ms single-request but
  2.08s (p95 2.88s) under just 20 concurrent users, with zero application
  errors — and even a confirmed Redis cache-hit homepage read (`meta.cached:
  true`) took 3.5–4.2s. Since every query plan involved is sub-10ms
  server-side, this reads as network latency from this dev machine to the
  remote Atlas/Redis Cloud endpoints, not an application defect. Flagged for
  re-measurement from infrastructure closer to the database before drawing
  any production-capacity conclusion from it.
- **Lighthouse** — a `npm run dev` run scored Performance 55 (FCP 11.1s,
  LCP 19.7s), which is a known Vite dev-mode artifact (unbundled ESM over
  hundreds of requests), not a real number. Re-ran against a production
  build (`vite preview`): **Performance 83, LCP 2.9s, TTI 2.9s** — this is
  the baseline to use going forward.

### Docs updated
- New: `lookbook-backend/docs/thesis/performance-load-testing.md`.
- `lookbook-backend/docs/phase-13-status.md` — §13.2 table flipped from
  🧱 (built, not run) to ✅ (run, results recorded) for all 4 sub-items
  except the 10k/50k vector tier; §13.6 Atlas row updated with the new
  write-hang and latency observations; new 2026-08-27 section added.

### Verification
- Backend/frontend dev servers boot clean from a cold start (MongoDB Atlas
  connects, BullMQ workers start, Vite serves on :5173); one nodemon-induced
  Atlas TLS crash during this session recovered on restart (matches
  documented flakiness).
- `npm run build` (frontend) reproduces the 2026-08-18 bundle numbers exactly
  (420.22 kB / 131.95 kB gz main chunk) — no regression.

---

## ✅ Session Update — 2026-08-20: §13.1 verified end-to-end in Chrome + permanent e2e coverage

Re-tested the whole recommendation-experimentation layer (§13.1 of
`UPDATED_FUTURE.md` Part B) against the running stack and made the verification
permanent. No product code needed changing — the feature was already built; this
session proved it works and locked it in with tests.

### What was verified (live, API + Chrome)
- **A/B arm assignment & persistence** — `User.recommendationArm` has no schema
  default and is lazily assigned on first homepage fetch. Verified both arms over
  live users: `hybrid` (personalized: "Because you read X" / "Similar to your
  recent reads" / "Trending in …" reasons) and `popularity` (control: every
  recommendation slot served "Most popular with all readers"). Arm stayed stable
  across repeated fetches and separate login sessions.
- **Explainability tags** — `GET /api/homepage` returns `arm` + per-book `reasons`;
  the frontend renders them as "why" badges on the recommended cards.
- **Attributed analytics** — `recommendation_view` (per row: `arm`, `section`,
  `bookIds`) and `recommendation_click` (`arm`, `section`, `reason`, `bookId`)
  fire from `BookRow`/`BookCard`; conversion events (`wishlist_add`, `add_to_cart`,
  …) chain by session in `utils/abStats.ts`.
- **AB report** — `GET /admin/analytics/ab-report` returns per-arm
  impressions/clicks/conversions, CTR, click→conversion, a two-proportion z-test,
  and a per-source breakdown; the admin `ProductAnalyticsPanel` renders all of it.

### What was added
- **New permanent e2e specs** — `lookbook-frontend/e2e/phase13-ab.spec.ts`
  (2 tests): homepage A/B arm + "why" badges + attributed events, and the admin
  AB-report panel (rows + z-test + per-source breakdown). Chrome/Chromium project,
  consistent with the existing suite. Full e2e count: **6 → 8**.
- **Docs updated** — `UPDATED_FUTURE.md` §13.1 checkboxes now reflect the
  completed state (only "run over a real usage window" remains deferred — needs
  live traffic); `docs/phase-13-status.md` gained the 2026-08-20 verification
  entry.

### Verification
- Backend Jest **26/26**; frontend Vitest **14/14**; Playwright Chrome e2e **8/8**
  (incl. the 2 new §13.1 specs).
- `tsc --noEmit` / `tsc -b` clean on both apps; eslint clean (backend 0 errors /
  5 pre-existing warnings; frontend 0 errors).
- Note: Atlas connectivity remains flaky on *fresh* TLS connections (~SSL alert
  80); the backend was re-booted with retries until connected (per §13.6 guidance).
  Test users created during verification (`abtester.phase13.*`, `poparm*`) are
  harmless demo data in the `test` database.

---

## 🔧 Hotfix — 2026-08-18: Live-verification bug fixes (cover images, dataset export, query indexes)

Everything in this entry was discovered while running the live Phase 13 verification against Atlas.

### Book / category cover images (user-reported: books showing "repeated gifs / icons")
- Root cause: the live DB still held legacy **local placeholder paths** (`/books/book1.jpg`…`/books/book5.jpg`) from the pre-2026-08-07 static-cover seed. Those files no longer exist anywhere (no `public/books/`, no backend static route), so the browser got 404s → the frontend's `onError` fallback showed the gradient `BookPlaceholder` (icon) over and over.
- Scope: **13 books** (5× book1, 2× each book2–5) and **6 category covers** (all six categories).
- Fix:
  - All 13 books updated to **real Open Library covers** (`https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`) resolved by title/author search.
  - Every cover verified by **decoding actual image dimensions** from the downloaded bytes (JPEG SOF / PNG IHDR / GIF header / SVG detection) — 179/179 unique URLs healthy, none are the Open Library 1×1/SVG "no cover" placeholder.
  - 3 books with no Open Library record (incl. "Test Seller Book") and the 6 categories were **cleared** so the frontend renders its designed gradient placeholder instead of a broken image.
- Re-verified in a real browser (Playwright/Chromium): homepage 17/17 covers load, book-detail 5/5, categories 11/11 — **zero broken images** (the earlier "6 tiny/1×1" were actually 404s from these legacy paths).

### `export:dataset` reported "1 books" (`dataset.ts`)
- `loadDataset` read `b.id` on `.lean()` docs, but lean docs expose `_id`, not the `id` virtual → every book collapsed into a single Map entry under key `undefined`. Fixed to `_id.toString()`.
- Live export now: **185 books, 72 interactions, 21 users** (`experiments/dataset/snapshot-2026-08-18T06-07-14-348Z.json`).

### Homepage COLLSCANs (`Book.ts`)
- `popular` (`sort("-rating -reviewsCount")`) and `new releases` (`sort("-createdAt")`) were COLLSCANing. Added `{ rating: -1, reviewsCount: -1 }` and `{ createdAt: -1 }` indexes; `bench:query-plans` re-run confirms all IXSCAN (examined 185→8).

### Also verified live (Atlas, `test` DB)
- Full endpoint smoke (register/login/me/cart/wishlist/analytics/admin+ab-report/assistant); AB report with real events (hybrid imp=2 clk=1 conv=1, CTR 50%); `eval:recommendations` over the real snapshot (all 8 strategies); Redis had no stale homepage cache.
- Backend tsc clean, lint 0 errors (5 known warnings), Jest 26/26; frontend lint clean, build clean, Vitest 14/14.

---

## 🧪 Session Update — 2026-08-18: Phase 13 (Experimentation & Platform Hardening) — completed against the rewritten `UPDATED_FUTURE.md`

`UPDATED_FUTURE.md` was rewritten into **Part A (Phases 0–12, as built) + Part B
(Phase 13: Experimentation & Platform Hardening, §13.1–13.6)**. The earlier
M.Tech research work (offline eval framework, thesis docs, provider
comparison) is retained and now maps onto the new sections. Everything below
was checked against the new file.

### §13.1 Recommendation experimentation infrastructure (done)
- `User.recommendationArm` (`"hybrid"` | `"popularity"`), **no schema default** —
  assigned lazily & persistently on first homepage fetch (`ensureArm`), so a
  user keeps a consistent arm across sessions.
- `GEMINI_TEXT_MODEL` env-driven (default `gemini-2.5-flash`) — model swappable
  without a redeploy.
- Homepage serves **both arms from the same endpoint**; every recommended book
  carries a short "why" `reasons` tag.
- `recommendation_view` / `recommendation_click` analytics events tagged with
  `arm`/`section`/`reason`; `wishlist_add`, `add_to_cart`, `product_view` added
  so conversions attribute back to the serving arm (same-session chain,
  `utils/abStats.ts` two-proportion z-test — verified against synthetic events).
- **Admin UI panel for the AB report** — `ProductAnalyticsPanel` now renders the
  arm table + TestVerdict (previously API-only).
- Frontend-awareness decision recorded in `docs/thesis/design-decisions.md`:
  transparent serving; frontend tags events only, no behavioral branching.

### §13.2 Performance & load testing
- **k6 scripts** for book-search / AI-search / checkout / chat + `benchmarks/k6/README.md`.
- `bench:query-plans` (`explain("executionStats")` on the top-5 heaviest app
  query shapes) and `bench:vector` (embedding search at 1k/10k/50k synthetic
  books) — **built; run deferred** (needs live MongoDB).
- **Bundle/asset audit done:** route-level `React.lazy` splitting for all pages
  except HomePage; removed the `react-icons` dependency entirely (brand icons
  rebuilt as tiny inline SVGs in `SocialIcons.tsx`). Main bundle
  **620 kB → 420 kB** (gzip 176 → 132 kB) — under Vite's 500 kB warning now.
  Audit: `docs/bundle-audit.md`. Lighthouse baseline pending deployment.

### §13.3 Security review
- OWASP Top 10 (2021) self-assessment table: `docs/thesis/owasp-checklist.md`.
- Dependency audit: `nodemailer` upgraded 6→9 (backend `npm audit` high fixed;
  remaining 2 highs are dev-only eslint toolchain); frontend at **0 vulns**.
  Evidence: `docs/thesis/dependency-audit.md`.
- **Secrets hygiene fixed:** `.env.example` had real credentials in every field
  (Mongo, JWT, Google/GitHub OAuth, Razorpay, Cloudinary, Groq, Gemini, Redis,
  SMTP) — now scrubbed to `<placeholder>` values; repo-wide scan confirms no
  hardcoded secrets outside `.env`; repo is not under git, so no history to audit.

### §13.4 Architecture docs & design-decision log (done)
- `docs/thesis/`: `architecture.md` (component/deployment), `er-diagram.md`,
  `sequence-diagrams.md` (checkout+webhook, hybrid search/recommendation, …),
  `design-decisions.md` — extended with the **5 required platform decisions**
  (Groq vs Gemini & provider-agnostic failover, Atlas Vector Search vs standalone,
  JWT+refresh vs server sessions, dual payments vs single, self-hosted vs SaaS
  analytics) plus the §13.1 frontend-awareness decision.

### §13.5 Deployment & reproducibility
- `docs/setup-from-scratch.md` — clean machine → running stack (env, seed,
  verification, optional catalog growth).
- Seed versioning: deterministic `src/data/*` fixtures + `npm run export:dataset`
  anonymized JSON snapshot (re-runnable via `eval:recommendations --snapshot`).
- Docker + CI **not verifiable here** (no Docker daemon / git remote) — tracked.

### Retained research layer (maps to §13.5.3 / §13.2)
- Offline eval framework: `evaluate/{dataset,metrics,baselines,svgChart,
  recommendationEval,abReport,llmComparison,exportDataset}.ts` — validated
  end-to-end on synthetic data (20 users / 154 interactions / 8 strategies →
  real metrics + `results.csv`/`report.md` with inline SVG charts). Fixed a
  `buildDataset` bug (median split derived when `splitDateMs` null — previously
  sent all interactions to train).
- `docs/thesis/`: README, complexity, contribution-statement, dependency-audit.

### Verification
- Backend: `tsc --noEmit` clean; eslint warnings-only; **Jest 26/26** (incl.
  `aiRateLimit.test.ts` now mocking the AI/embedding layer).
- Frontend: `tsc -b` clean, eslint clean, **Vitest 14/14**, `vite build` passes.

### Deferred / blocked (user- or infra-side)
- Live runs need the machine's IP whitelisted on Atlas (cluster currently
  unreachable): `bench:query-plans`, `bench:vector`, `export:dataset`,
  `eval:ab` against real data.
- `eval:llm` needs a valid Groq key (current key returns 401; AI falls back to
  Gemini meanwhile).
- Docker+CI verification (§13.5.1) and Lighthouse baseline (§13.2.4b) need real
  infra/deployment. Full status: `docs/phase-13-status.md`.

---

Running every layer against the live stack surfaced **three real bugs** (all
fixed) plus a batch of latent type/lint issues that `tsc --noEmit` alone had
missed. Stripe checkout was explicitly skipped this session per request.

### 🐛 Bug fixes

1. **ISBN catalog-first lookup never matched seeded books.** `GET
   /books/by-isbn/:isbn` normalized input to `9780735211292`, but the seed
   catalog stores `978-0735211292` (with dashes), so `Book.findOne({ isbn })`
   always missed and every ISBN lookup fell through to Open Library. Fixed in
   `bookController.ts` with a dash/space-tolerant regex
   (`/^9[- ]?7[- ]?8…$/`), plus a `Book` pre-save hook and seed normalization
   so all future writes are stored consistently.
2. **SSE chat stream sent the reply only in the `done` event.** Plain
   (non-tool) answers never emitted `delta` events, so `ChatAssistant`'s
   typewriter bubble stayed permanently blank. Backend (`assistantController.ts`)
   now emits a `delta` carrying the full reply before `done`; the frontend
   additionally falls back to the `done` message payload when no deltas arrive.
3. **Unhandled external-API failures.** The admin Open Library
   search/import (`searchBooksApi`) leaked a raw undici `fetch failed` as a
   500. Now returns a clean **503** via a new `ApiError.serviceUnavailable`.
4. **Type/lint cleanup caught by `tsc -b` (stricter than `--noEmit`)**:
   - `orderService.checkout` is now generic `<P extends …>` so the
     `CheckoutResponse` discriminated union actually narrows (`Cart.tsx` was
     the only consumer).
   - `NotificationBell` VAPID key typed `Uint8Array<ArrayBuffer>` for the
     newer `BufferSource` contract; `IsbnScanner` dropped a non-existent
     `IScannerControls` type import and an unused callback arg;
     `ProductAnalyticsPanel` referenced a non-existent `data.days`;
     `Sell.tsx` unused import + a `.filter(Boolean)` that didn't narrow.
   - eslint: `useTheme` fast-refresh exception (same convention as `useAuth`);
     ProductAnalyticsPanel refactored to avoid synchronous `setState` in an
     effect, with a stale-response guard on the range selector.

### 🧪 Test expansion
- **Playwright Chrome e2e: 2 → 6 tests.** New `e2e/feature-smoke.spec.ts`:
  dark-mode toggle + persistence, `/developers` public-API page, sell-page
  manual-ISBN pre-fill via the catalog-first lookup, and an AI-chat SSE
  round-trip (welcome bubble → sent prompt → streamed reply).
- **Backend Jest: 19 → 21.** Two regression tests for the ISBN endpoint
  (dash-format catalog match; clean 404 for an unknown ISBN).
- **Live API smoke harness (Node + fetch):** exercised 66 endpoints against
  the running stack — auth (register/login/logout-with-CSRF/refresh/sessions),
  public API, catalog + ai-search + by-isbn, cart/wishlist/shelves/addresses,
  orders (Razorpay checkout → verify-reject → cancel), listings + scan-price,
  assistant chat, reading/sustainability, notifications incl. push-config,
  challenges, clubs/follow feed, admin (dashboard, analytics, events, orders,
  users, audit-logs, sellers pending → approve, books-api, pricing), seller
  inventory, and 2FA setup/disable. **65/66 green**; the only failure is the
  admin Open Library search returning the new 503 because this sandbox has no
  outbound internet (same environment limitation as prior sessions).

### Roadmap status (unchanged — everything codeable is done)
The reconciliation from 2026-08-15/16 stands: all non-Stripe, non-credential-
gated roadmap items are implemented. Remaining deferrals are genuinely
blocked on either external keys/accounts (Groq, Cloudinary, Google OAuth
redirect whitelist, Shiprocket, Sentry DSN, PostHog/GA4) or are
demand-gated extensions (React Native, i18n/multi-currency, coupons/support
tickets/reports, book exchange/donation, library management, university/
enterprise plans).

### Verification
- Backend `tsc --noEmit` + frontend `tsc -b` clean; frontend `eslint`
  clean; `vite build` succeeds.
- **Bundle slim-down:** the ISBN scanner (incl. `@zxing/library`, ~412 kB) is
  now `React.lazy` code-split in `Sell.tsx`, so it loads only when the Scanner
  modal opens — the main JS chunk dropped ~1.03 MB → ~615 kB (gzip 286 → 175 kB).
- Backend Jest **21/21**; frontend Vitest **14/14**; Playwright Chrome e2e
  **6/6** — all after the fixes above.

---

## 🔧 Session Update — 2026-08-15/16: Commerce gap-fill, ISBN scanner, public API docs + roadmap reconciliation

Closed the remaining codeable gaps between `future.md`'s roadmap and what was
actually implemented, and reconciled the change log with the state of the
repo (several backend features built earlier were never logged).

### 💳 §2.1 — Stripe provider now end-to-end on the frontend
The backend already supported a `provider: "stripe"` checkout path (hosted
Stripe Checkout Session) but nothing in the UI used it. Now the buyer can pay
by card through Stripe when the server advertises it.
- `lookbook-frontend/src/services/orderService.ts` — `checkout(address,
  provider)` (Razorpay by default) with a discriminated-return union, and
  `verifyPayment(orderId, provider, payload)` covering both Razorpay and
  Stripe (`stripe_session_id`) confirmation.
- `lookbook-frontend/src/components/cart/CartSummary.tsx` — optional
  "Pay with Card (Stripe)" button, surfaced only when `GET /config` says
  `stripe.available`.
- `lookbook-frontend/src/pages/Cart.tsx` — fetches client config on mount and
  wires the Stripe flow: create order → redirect to Stripe's hosted session.
- `lookbook-frontend/src/pages/PaymentSuccess.tsx` (new) + route
  `/orders/:orderId/payment-success` — Stripe's redirect target; verifies the
  session server-side, clears the cart, and confirms/errors for the buyer.

### 🔖 Stretch #4 — Barcode/ISBN scanner for sellers
- `lookbook-backend/src/utils/openLibraryApi.ts` — added `fetchBookByIsbn()`
  (Open Library `search.json?isbn=`).
- `lookbook-backend/src/controllers/bookController.ts` + `src/routes/bookRoutes.ts`
  — new `GET /books/by-isbn/:isbn` (protected): checks our catalog by ISBN
  first (dedupe), else resolves via Open Library, returning pre-fill metadata.
- `lookbook-frontend` — added `@zxing/library` dependency;
  `src/components/sell/IsbnScanner.tsx` (new) reads the ISBN barcode from the
  device camera (ZXing multi-format, `facingMode: environment`); `Sell.tsx`
  gained a "Scan ISBN barcode" button + a manual-ISBN entry field. Decoded
  ISBNs pre-fill the listing form via `bookService.lookupBookByIsbn`.

### 🌍 Phase 12 stretch — Public API made discoverable
- `lookbook-frontend/src/pages/Developers.tsx` (new) + `/developers` route +
  a "Public API" link in the footer — documents the existing read-only
  `/public/books`, `/public/books/:id`, `/public/categories` endpoints with a
  base URL + copy-paste examples.

### 📋 Roadmap reconciliation & log cleanup
- The "Future changes (not yet started)" section has been rewritten — the
  following roadmap items previously listed as open are now **done** (they
  shipped in earlier sessions but were never written down): AI OCR book-cover
  upload (§3.1 `POST /listings/scan` + `GET /listings/scan-price`), AI chat
  assistant with tool-calling + SSE streaming (§3.3 `POST /assistant/chat` /
  `/assistant/chat/stream`), AI duplicate-listing detection (§3.6), AI
  cover-quality check (§3.7), backend voice transcription (§3.8
  `POST /assistant/transcribe`), self-hosted product analytics (§11.1 `Event`
  collection + `POST /analytics/track` + `GET /admin/analytics/events`), dark
  mode (Phase 12 ThemeProvider), smart/dynamic rental pricing (Stretch #2 —
  `pricingQueue`, `POST /admin/books/:id/pricing`, `POST /admin/pricing/run`),
  web push notifications (§10.2 — `PushSubscription`, VAPID fan-out,
  subscribe/config/delete endpoints, `sw.js` handlers + bell toggle), and
  shipment tracking (§2.3 — `PATCH /admin/orders/:id/tracking`).
- Remaining genuinely-deferred items (kept deferred per the roadmap's own
  "revisit based on real usage data" guidance): React Native app, i18n /
  multi-currency, external product-analytics SaaS (PostHog/GA4 — the
  self-hosted tracker covers the funnel meanwhile), Shiprocket courier API
  (no API key — the tracking fields/manual admin editor are in place),
  Sentry APM (logging is pino-based; no DSN configured), book exchange /
  donation, library-management mode, university partnership / enterprise
  plans, and coupons / support tickets / reports (Phase 4 listed these "once
  the underlying features exist").

### Verification
- `tsc --noEmit` clean on backend and frontend; frontend `vite build` succeeds.
- Backend Jest **19/19**; frontend Vitest **14/14** — both passed after these
  changes.
- Stripe and ISBN flows are env/credential-gated where applicable (Stripe keys
  not set in this dev env, so the checkout button hides; ISBN lookup falls
  back to Open Library which needs no key).

---

## 🔧 Session Update — 2026-08-15: AI features, analytics, push, dark mode

Completed the remaining frontend work for the roadmap items already landed
backend-side, plus a couple of small backend additions to match the UI.

**Backend additions (small, for the UI):**
- `src/routes/notificationRoutes.ts` + `src/controllers/pushController.ts` —
  `GET /notifications/push-config` now also returns the public VAPID key so
  the browser can create a push subscription.

**Frontend — AI & voice:**
- `src/pages/Sell.tsx` (§3.1) — "Scan cover with AI" button uploads a cover
  photo to `POST /listings/scan` and pre-fills title/author/category + suggested
  price; "Suggest price" button calls `POST /listings/scan-price`.
- `src/components/common/ChatAssistant.tsx` (§3.3 #4) — switched from the
  single-shot `/assistant/chat` to streaming `POST /assistant/chat/stream` (SSE),
  rendering the reply with a typewriter effect as deltas arrive.
- `src/components/common/SearchBar.tsx` (§3.8) — mic button using the Web
  Speech API (`en-IN`), submits the transcript into search on result.

**Frontend — analytics (§11.1):**
- `src/utils/analytics.ts` — new capture-twice-safe tracker (`sendBeacon`) with
  a persisted anonymous session id; `src/components/common/RouteTracker.tsx`
  fires `page_view` on every route change (mounted in `App`).
- `src/pages/admin/ProductAnalyticsPanel.tsx` — new event funnel + daily
  volume panel backed by `GET /admin/analytics/events`, mounted on the admin
  dashboard with a 7/14/30-day selector.

**Frontend — admin tools:**
- `src/pages/admin/AdminBooks.tsx` — smart-rental-pricing editor per book
  (enable + min/max rent bounds → `POST /admin/books/:id/pricing`) and a
  "Run smart pricing" button (`POST /admin/pricing/run`).
- `src/pages/admin/AdminOrders.tsx` — per-order delivery tracking editor
  (tracking number, carrier, shipment status, URL, pickup slot →
  `PATCH /admin/orders/:id/tracking`).

**Frontend — push notifications (§10.2):**
- `public/sw.js` — added `push` + `notificationclick` handlers (show/route
  into the relevant link).
- `src/components/common/NotificationBell.tsx` — browser-push enable toggle
  (subscribes with the VAPID key, saves via `POST /notifications/subscribe`,
  unsubscribes + removes via `DELETE`).

**Frontend — dark mode (Phase 12):**
- `src/context/ThemeContext.tsx` — theme provider toggling the `dark` class on
  `<html>`, remembering the choice and defaulting to `prefers-color-scheme`.
- `src/components/common/Navbar.tsx` — sun/moon toggle; `src/index.css` —
  base dark surface/text overrides. Full per-component theming can tier on top
  of the mechanism later.

**Types/services:**
- `src/types/index.ts` — `Book.pricing` and `Order` tracking fields; the
  `listingService` gained `scanBookCover`/`suggestListingPrice`, `adminService`
  gained product analytics/pricing/tracking endpoints, `notificationService`
  gained push config/subscribe/delete.

**Verification:** `tsc --noEmit` clean (frontend + backend), `vite build` OK,
backend 19/19 and frontend 14/14 tests pass.

---

## 🔧 Session Update — 2026-08-07: Removed static book cover images

Per user request, removed the static book images from the frontend
`public/books` folder (book1–5.jpg) and every reference to them. The app now
relies entirely on real cover URLs (Open Library imports, seller-uploaded
photos); when a book has no cover, a generated gradient placeholder shows
instead.

**Files deleted:**
- `lookbook-frontend/public/books/` (book1–5.jpg) — the static covers
- `lookbook-frontend/dist/books/` — stale build copy (rebuilt output is clean)

**Frontend changes:**
- `src/components/home/PopularCategories.tsx` — dropped the `fallbackCovers`
  array and its decorative side thumbnails; category cards now render only
  `category.image` with a gradient block when no image is set.
- `src/components/home/Hero.tsx` — unchanged; keeps its `src/assets/books/book1.jpg`
  hero image (per user choice).
- `src/components/book/BookHero.tsx`, `src/components/cart/CartLineItem.tsx`,
  `src/components/profile/OrderHistory.tsx` — added a generated gradient
  placeholder cover for books with no image (BookCard already had one).

**Backend changes:**
- `src/models/Book.ts`, `src/models/Category.ts` — `image` is now optional
  (was `required: true`).
- `src/data/seedBooks.ts`, `src/data/seedCategories.ts` — removed the
  `/books/bookN.jpg` image values from seed data.
- `src/controllers/listingController.ts`, `src/controllers/bookImportController.ts`,
  `src/scripts/importBooksFromApi.ts` — removed the `FALLBACK_IMAGE` constant
  (was `/books/book1.jpg`); books just store whatever real URL they have.
- `src/validators/bookValidators.ts` — admin book-create schema allows a
  missing image.

**Verified:**
- Backend `tsc --noEmit` clean; frontend `tsc --noEmit` clean; frontend
  production `vite build` succeeds (no `dist/books` output).
- Backend Jest **19/19**, frontend Vitest **14/14** — both passed after the
  changes.
- Playwright e2e could not be completed this run because the shared MongoDB
  Atlas connection was unreachable (`MongooseServerSelectionError`) — an
  environmental outage, not a code regression (the suite passed 2/2 on the
  previous run). The two e2e specs cover register→browse→cart and a book
  review; rerun once Atlas connectivity recovers.

---

## 🔧 Session Update — 2026-08-07: Verified API-only book catalog (no static books)

Audited the frontend end-to-end to confirm **all book/category/homepage data
is served exclusively by the backend API** — no static book data is used.

**Findings (no code changes required — already compliant):**
- `lookbook-frontend/src` has no `data/` directory and no hardcoded
  book arrays. `src/data/*` (books/categories/plans) was already deleted in a
  prior session; greps for `mock|dummy|hardcoded|static` and for book-shaped
  arrays (`const books = [...]`, `title:`/`price:` literals) return nothing
  in app code.
- Every surface sources books from the API:
  - Homepage rows → `homepageService` → `GET /api/homepage`
  - Catalog/category/search/AI → `bookService`/`categoryService` →
    `GET /api/books`, `GET /api/categories`, `GET /api/books/ai-search`
  - Book detail → `fetchBookById` → `GET /api/books/:id`
  - Admin books & seller inventory → `fetchBooks` → `GET /api/books`
- `BookCard` renders purely from the API `Book` object; the only "static"
  cover images (`PopularCategories` fallback covers, `Hero` hero book) are
  decorative thumbnails, not book data, and the `BookPlaceholder` gradient is
  generated from the book title at runtime.
- Backend serves books from MongoDB (seeded once via `npm run seed` + admin
  Open Library import), never from in-memory/hardcoded responses.

**Verified against the running stack:** `GET /api/books` returns real seeded
records ("Atomic Habits", "Where The Crawdads Sing", …).

**Full test run — all green:**
- Backend Jest: **19/19** passed.
- Frontend Vitest: **14/14** passed.
- Playwright Chrome e2e: **2/2** passed (register → browse → add to cart;
  submit a review from a book detail page).

---

## 🔧 Session Update — 2026-08-07: BullMQ/Redis reliability fix + test-config fix

### 🐛 Critical bug fix — BullMQ workers repeatedly failing, log spamming

**Root cause:** `lookbook-backend/src/queues/connection.ts` created **one
shared ioredis connection** for all 3 Queues **and** all 3 Workers. BullMQ
requires a dedicated connection per Queue/Worker: Workers issue blocking
commands (`BRPOPLPUSH`) that tie up the socket for the whole poll, so sharing
a single socket with Queue commands collides them — and one dropped TCP
connection (this environment's connectivity to the managed Redis Cloud
instance is intermittently flaky: DNS `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`,
even a Mongo TLS alert) took every queue down at once. Consequences observed:
`could not renew lock` / `Missing lock for job N. moveToFinished` (fatal job
loss), and a ~142k-line error-spam log.

**Fix (all in `lookbook-backend/src/queues/`):**
- `connection.ts` — each Queue/Worker now gets its **own** connection
  (`createQueueConnection` / `createWorkerConnection`), so a reset in one can
  never take the others down. Options follow BullMQ's recommended ioredis
  config: `maxRetriesPerRequest: null` (required for blocking commands),
  `keepAlive: 60_000` (stops managed providers resetting idle sockets —
  ioredis defaults keepAlive to 0), bounded reconnect backoff, and
  `connectTimeout`. The offline queue is left at its default so a command
  issued mid-reconnect buffers instead of throwing "Stream isn't writeable"
  on every poll.
- `rentalReminderQueue.ts`, `leaderboardQueue.ts`, `analyticsQueue.ts` —
  each Queue and Worker uses its own connection, and every Worker now gets a
  raised `lockDuration` (5–15 min) so the slow SMTP reminder sweep and the
  analytics history backfill can never expire their lock mid-run.
- `connection.ts` — new `attachQueueErrorHandler()`: rate-limits logging of
  *transient connection errors* so a flaky window produces one concise line
  instead of one full stack trace per reconnect attempt. Non-connection
  errors (e.g. job-processing failures) are always logged immediately and in
  full — nothing is silently dropped, only batched. Wired onto every Queue
  and Worker.

**Verified:** backend ran for multiple monitoring windows with **zero**
Redis/BullMQ errors (the fatal lock failures are gone entirely); the only
remaining log lines were legitimate 401/403 API logs. The residual rare
DNS/connect blips are environmental (cloud-Redis reachability) and the app
now recovers from them automatically instead of failing jobs. Re-confirmed
full stack afterwards: backend Jest **19/19**, frontend Vitest **14/14**,
Playwright Chrome e2e **2/2**.

### 🧪 Test-config fix — Vitest was picking up Playwright specs
- `lookbook-frontend/vite.config.ts` — `npm test` (Vitest) was matching the
  Playwright spec in `e2e/` against its default glob and failing while trying
  to run it in jsdom. Added `exclude: ["e2e/**", "node_modules/**"]` so unit
  and e2e suites stay cleanly separated.

---

## 🔧 Session Update — 2026-08-06: AI Features (§3.3, §3.6, §3.7), Auth & Catalog Improvements, Bug Fixes

### 🤖 AI Features (§3.3, §3.6, §3.7)
- **3.3 — AI Chat Assistant**:
  - **Backend**: New `lookbook-backend/src/controllers/assistantController.ts` & `assistantRoutes.ts` — Gemini-backed chat assistant with read-only tool-calling (`searchBooks`, `getOrderStatus`, `getActiveRentals`). Wired to `POST /api/assistant/chat`.
  - **Frontend**: New floating `lookbook-frontend/src/components/common/ChatAssistant.tsx` widget with spring animations, typing indicator, suggested prompts, and bubble layout. Globally mounted in `App.tsx`, visible to logged-in users.
- **3.6 — AI Duplicate Listing Detection**:
  - **Backend**: `lookbook-backend/src/models/Listing.ts` — added `duplicateFlag`, `duplicateCandidate`, and `duplicateReason` fields. `listingController.ts` — `createListing` triggers async AI duplicate detection (text match + optional vision comparison).
  - **Frontend**: `lookbook-frontend/src/pages/admin/AdminListings.tsx` — shows ⚠️ badges on flagged listings, a "Duplicates" filter button, and a side-by-side comparison modal.
- **3.7 — AI Cover Quality Check**:
  - **Backend**: `lookbook-backend/src/controllers/uploadController.ts` — inline Gemini Vision check rejects blurry or non-book-cover images *before* Cloudinary upload, returning the model's reason to the user.

### 🔐 Auth / Google OAuth
- **Backend**: `lookbook-backend/src/validators/authValidators.ts` — removed Gmail-only restriction; accepts any valid email address for registration.
- **Frontend**: `Login.tsx` & `Register.tsx` — OAuth buttons updated with official Google colored SVG logos, improved GitHub button styling, and enhanced copy ("Continue with Google" / "Sign up with Google").

### 📚 Book Catalog
- `BookCard.tsx` — Proper image fallback handling: gracefully handles broken URLs, Open Library's 1×1 "no cover" placeholder GIF, and missing covers using a modern gradient placeholder based on the book title's first letter. Added `loading="lazy"`.

### 🐛 Bug Fixes
- `.env` & `.env.example` — Removed the `redis-cli -u` prefix from `REDIS_URL` to fix raw string parsing issues.
- **Upload UX**: `Sell.tsx` — improved error messaging for both unconfigured Cloudinary credentials and AI cover quality check rejections.
- **Type Safety**: Updated frontend `Listing` interface to support duplicate-detection fields (`duplicateFlag`, `duplicateReason`, `duplicateCandidate`).


## 🔧 Session Update — 2026-07-23: Gmail-verified signup + real book catalog

### Registration now requires a verifiable Gmail address
- `lookbook-backend/src/validators/authValidators.ts`: `registerSchema`
  rejects any email that doesn't end in `@gmail.com` (login is untouched —
  existing accounts with other domains can still sign in; only new
  email/password signups are restricted). OAuth signups are exempt since
  Google/GitHub already vouch for those addresses.
- `lookbook-backend/src/middleware/auth.ts`: new `requireVerifiedEmail`
  guard, wired onto `POST /orders/checkout` — an account that never clicked
  its verification link can browse, cart, and wishlist, but can't place a
  real paid order. This is the first place `emailVerified` was ever actually
  *enforced*; before this it was purely informational (a dismissible banner).
- `lookbook-frontend/src/pages/Register.tsx`: relabeled the field "Gmail
  Address", added a matching client-side check for a fast/friendly error,
  and updated the helper copy.
- Verified: non-Gmail registration rejected, Gmail registration succeeds
  with `emailVerified: false`, checkout blocked with a clear message while
  unverified, and a pre-existing verified account's checkout is unaffected
  (no regression).

### Real, growing book catalog (Open Library integration)
Replaced the static ~10-book seed with a genuine external-API integration —
tried Google Books first, but its unauthenticated quota was already
exhausted on this network; switched to **Open Library**
(openlibrary.org/dev/docs/api), which is free, keyless, and has no
meaningful rate limit.
- `lookbook-backend/src/utils/openLibraryApi.ts`: search + per-book
  work-description lookup.
- `lookbook-backend/src/controllers/bookImportController.ts` (admin-only):
  `GET /admin/books-api/search?q=...` (flags results already in the
  catalog by ISBN/title+author) and `POST /admin/books-api/import`
  (dedupes, synthesizes rent/buy pricing from page count since Open Library
  has none, kicks off background embedding generation so imports stay
  searchable/recommendable).
- `lookbook-frontend/src/components/admin/BookApiImport.tsx`: new panel at
  the top of the admin Books page — search, preview (cover + title +
  author), multi-select, one-click import. This is the "dynamic" part: an
  ongoing capability, not a one-off backfill.
- `lookbook-backend/src/scripts/importBooksFromApi.ts` (`npm run
  import:books`): ran this now across all 6 existing categories (Fiction,
  Business, History, Self Help, Romance, Science) to actually grow the
  catalog immediately rather than just building the capability — **imported
  150 real books in one pass**. Combined with a live 24-book Agatha Christie
  import tested through the actual admin UI, the catalog went from 11 books
  to **185**, all with real titles, authors, covers, and (for the API
  results) real page counts/publishers where Open Library has them.
- Verified: search, filtering, and pricing all correct on the new data
  (e.g. searching "Asimov" correctly returns *The Caves of Steel*,
  *The Foundation Trilogy*, *Nightfall*, priced from real page counts).

---

## 🔧 Session Update — 2026-07-22/23: Bug fixes + feature requests

### Critical bug fix: session refresh silently broken app-wide
**Root cause:** the CSRF double-submit cookie (added in the Security phase
below) was issued with `path: "/api/auth"`. Browsers scope `document.cookie`
*reads* to the **currently loaded page's** path, not the path of whatever
request you're about to make — and since every frontend route lives under
`/`, never under `/api/auth`, the frontend could never actually read the
cookie value it needed to echo back as a header. Every `/auth/refresh` and
`/auth/logout` call was silently failing with 403, meaning: sessions didn't
survive a page reload, "Remember me" didn't work, and logout could leave a
stale cookie behind. This is very likely what read as "the integration of
the objects is not good."
- **Fix:** `lookbook-backend/src/utils/authSession.ts` — CSRF cookie path
  changed from `/api/auth` to `/`. (It's still only ever *sent* to
  `/api/auth/*` by the browser regardless — that's governed by the
  *request's* path, which was never the problem.)
- Verified end-to-end: login → immediate refresh → full page reload → still
  authenticated, both via curl and via the live browser session.

### Google / GitHub OAuth — diagnosed, not a code bug
Investigated "Google/GitHub login doesn't authenticate":
- Confirmed both `GOOGLE_CLIENT_ID`/`SECRET` and `GITHUB_CLIENT_ID`/`SECRET`
  are valid, live credentials (tested via a deliberately-invalid auth code —
  both providers responded with "bad code" errors, not "bad client" errors).
- Confirmed the backend constructs both authorize URLs correctly
  (`redirect_uri=http://localhost:5000/api/auth/{provider}/callback`).
- **GitHub**: works end-to-end — loading the authorize URL reaches the real
  "Authorize LookBook" consent screen.
- **Google**: fails with `Error 400: redirect_uri_mismatch`. **This needs
  your action**: open the Google Cloud Console → APIs & Services →
  Credentials → this OAuth 2.0 Client ID → Authorized redirect URIs, and add
  exactly: `http://localhost:5000/api/auth/google/callback`. No code change
  can fix this — Google rejects the request before it ever reaches our
  server.

### Book Clubs — real depth added
- `lookbook-backend/src/controllers/clubController.ts`: added `updateClub`
  (owner/admin can edit name/description) and `removeMember` (owner/admin
  can kick a member, owner can't be removed). `deleteClub` now also cleans
  up the club's threads/comments instead of leaving them orphaned, and its
  admin-can-delete check now matches a shared `isOwnerOrAdmin` helper.
- `lookbook-backend/src/routes/clubRoutes.ts`: added `PATCH /:id` and
  `DELETE /:id/members/:memberId`.
- `lookbook-frontend/src/pages/ClubDetail.tsx`: **fixed a real bug** — the
  "Delete Club" button only checked `isOwner`, never `role === "admin"`,
  even though the backend always allowed admins. Now both see it. Added:
  inline name/description editing, an expandable member list (click the
  member count), and a remove-member control for the owner/admin.
- `lookbook-backend/src/routes/clubRoutes.ts`,
  `lookbook-frontend/src/services/clubService.ts`: wired the two new endpoints.

### Homepage personalization — more visible, not just "works"
- `lookbook-frontend/src/components/home/PersonalizedSections.tsx`: added a
  gradient CTA banner ("Tell us what you love to read") shown only to
  logged-in cold-start users, linking to `/onboarding`.
- `lookbook-frontend/src/components/home/BookRow.tsx`,
  `src/components/common/SectionHeading.tsx`: added an optional "✨ For You"
  badge on section headings for genuinely personalized rows (Continue
  Reading, Recommended, Because You Read, Similar to Wishlist, and Popular
  In Your Genre once the user isn't cold-start) — widened `SectionHeading`'s
  `title` prop from `string` to `ReactNode` to support this.
- The "usual books for a user with no preferences" fallback was already
  correct (fixed earlier this session, see below) — verified again here.

### UPI payment option
- Investigated Razorpay's dedicated QR Code API (`/v1/payments/qr_codes`)
  for a standalone scannable QR on the checkout page. **Confirmed via a
  direct API call that this product isn't provisioned on the current
  Razorpay test account** (a bare `GET` to list QR codes 404s, while every
  other Razorpay endpoint on the same key works fine — this is account-level
  feature gating, not a credentials or code problem).
- Rather than ship a checkout button that 400s, implemented the working
  alternative: `lookbook-frontend/src/utils/razorpayCheckout.ts` now accepts
  an `upiOnly` flag that scopes Razorpay's standard checkout widget directly
  to its UPI block (`config.display.blocks.upi`), skipping the payment-method
  picker. Razorpay's own UPI view includes a real scannable QR code (plus
  intent/collect) — no extra API product needed.
- `lookbook-frontend/src/components/cart/CartSummary.tsx`,
  `src/pages/Cart.tsx`: added a second "Pay via UPI (QR Code)" button next to
  "Proceed to Checkout", both going through the same `checkout()` →
  Razorpay → `verifyPayment()` flow, just with `upiOnly` toggled.

---

## ⚡ Phase 9 — Security

- **Rate limiting**: extended beyond auth to review submission (20/hour),
  listing submission (10/hour), and checkout (15/10min) —
  `src/middleware/rateLimiters.ts`.
- **CSRF protection**: double-submit-cookie pattern on `/auth/refresh` and
  `/auth/logout` (the only two endpoints that authenticate purely off the
  httpOnly refresh cookie) — `src/utils/csrf.ts`, `src/middleware/csrf.ts`.
  *(Cookie path bug found and fixed same day — see above.)*
- **2FA (TOTP)**: full opt-in flow — `src/controllers/twoFactorController.ts`,
  `otplib`. Setup → confirm-with-real-code → enabled; login for a 2FA
  account returns a short-lived challenge token (`purpose: "2fa-challenge"`,
  a distinct JWT type that can't be reused as a Bearer access token) instead
  of a session; a second call exchanges the challenge + code for the real
  session. Frontend: `src/components/profile/TwoFactorSettings.tsx`,
  challenge-code step built into `src/pages/Login.tsx`.
- **Audit log**: append-only `AuditLog` collection, written on every
  sensitive admin action (seller approve/reject, user suspend/reinstate,
  order status change/refund, damage resolution, payout resolution). Admin
  UI page at `/admin/audit-logs`.
- **Automated DB backups**: not implemented — MongoDB Atlas has scheduled
  snapshots built in at the infrastructure level; nothing for this app to
  build. Verify it's enabled on your Atlas cluster's Backup tab.
- Refresh-token rotation was already done in Phase 1 (atomic
  `findOneAndUpdate` prevents concurrent-request replay).

## 🔔 Phase 10 — Notifications

- **Email**: order confirmation, refund processed, and price-drop-on-a-
  wishlisted-book (checked whenever an admin edits a book's price) added as
  new templated emails in `src/utils/mailer.ts`. Seller approval/rejection
  emails already existed from Phase 4.
- **In-app notification center**: `Notification` model, bell icon with
  unread-count badge and dropdown in the navbar
  (`src/components/common/NotificationBell.tsx`), fired from order
  confirmation, refunds, seller approval/rejection, payout resolution, and
  rental-due reminders.
- **Push notifications**: not implemented — genuinely blocked on a PWA/app
  shell existing first (see Phase 12), matching the roadmap's own ordering.

## 📊 Phase 11 — Analytics

- **Business analytics**: a daily BullMQ job (`src/queues/analyticsQueue.ts`)
  rolls up revenue, order count, new/active users, top rented/sold books,
  and genre popularity into one `AnalyticsSnapshot` document per day. First
  run backfills the entire history in one pass instead of waiting a day per
  data point. Admin-facing endpoint `GET /admin/analytics`.
- Membership-plan revenue is always 0 — there's no real plan-purchase flow
  yet (Plans are still just a display page), so this wasn't fabricated.
- **Product analytics** (PostHog/GA4/Mixpanel): not implemented — needs a
  real account/API key this environment doesn't have.

## 🚀 Phase 12 — Future Expansion (partial)

- **PWA basics**: `public/manifest.webmanifest`, a hand-written
  `public/sw.js` (runtime-caches the app shell for offline launch;
  deliberately never caches `/api/*`), registered in `src/main.tsx`.
- Dark mode, React Native, i18n/multi-currency, and the "revisit based on
  demand" extensions (book exchange, library management, public API,
  university/enterprise plans) — not started, per the roadmap's own guidance
  to build these once there's real usage data justifying them.

## 🧪 Phase 8 — Testing

- **Backend**: Jest + Supertest + `mongodb-memory-server`, fully isolated
  (own in-memory Mongo, Redis/BullMQ explicitly disabled in tests — see bug
  note below). 19 tests: auth + CSRF, books/pagination, cart & wishlist,
  review validators, full 2FA cycle.
- **Frontend**: Vitest + Testing Library — 14 tests (format/csv utils,
  `useLocalStorage`).
- **E2E**: Playwright — register→browse→cart, and review submission, against
  the live dev servers.
- **Bug found & fixed**: the very first backend test run connected to the
  **real production Redis Cloud instance** instead of an isolated one,
  because only `MONGO_URI`/`JWT_SECRET` were overridden in test setup, not
  `REDIS_URL`. The lingering real connection kept retrying indefinitely
  after tests finished, hanging the whole process for hours before it was
  diagnosed. Fixed in `src/__tests__/globalSetup.ts` (also disables BullMQ
  during tests) plus a `forceExit: true` safety net in `jest.config.js`.

## 🌍 Phase 6 — Community

- **Follow system**: follow/unfollow, counts, followers/following lists, a
  feed of followed users' recent reviews.
- **Shelves**: generalized the old `user.wishlist` array into a real `Shelf`
  model. Migrated safely — `/api/wishlist` now reads/writes the user's
  default private Shelf under the hood with **zero frontend contract
  changes**, plus new endpoints for arbitrary named/public shelves.
- **Public profiles**: opt-in, shows follow counts, public shelves, recent
  reviews.
- **Book clubs & threads**: see the dedicated section above for what shipped
  today on top of the original Phase 6 build.
- **Verified Reader badge**: computed at display time (not stored) by
  checking for a paid Delivered/Returned order containing that exact book.
- **Reading challenges, badges, leaderboard**: admin-created challenges,
  progress off the existing "finished" activity log, lazy badge-award,
  leaderboard aggregation (now cached by the same BullMQ pattern as
  analytics — see Phase 7).

## ⚡ Phase 7 — Performance & Infra

- **Redis caching**: extended from homepage (already done in Phase 1) to
  categories and plans, with correct cache invalidation wherever category
  counts change.
- **BullMQ job queue**: rental due-date reminder emails (idempotent via a
  new `reminderSentAt` field) and challenge-leaderboard cache refresh, both
  repeatable jobs, both degrading gracefully to live queries if Redis is
  unavailable.
- **Cloudinary**: real upload endpoint built end-to-end (multer → Cloudinary
  → CDN URL), replacing the Sell page's "(Photo upload coming soon)"
  placeholder. **Blocked**: the provided Cloudinary credentials return
  `Invalid cloud_name` — same failure pattern as the Groq key (see Known
  Issues below). Code is correct and tested up to Cloudinary's own
  rejection; needs valid credentials.
- **Pagination**: added to the Rent page's book grid (Categories already
  had it).
- **DB indexing**: added indexes matching query patterns introduced in
  Phases 5/6 (`Order.items.book`/`status`, `UserActivity.action+createdAt`,
  `Listing.status`).
- **Docker + CI/CD**: added the missing frontend Dockerfile/nginx config
  (backend already had one), `docker-compose.yml`, GitHub Actions
  lint/typecheck workflow. **Unverified** — no Docker and no git repo in
  this environment, so neither was actually run.
- **Structured logging**: added `pino`/`pino-http` for JSON logs in
  production, and fixed a real gap where errors were previously logged
  *only* in dev — production errors went completely unrecorded before this.

## 🐛 Bug fix — homepage personalization looked broken

The homepage caches its personalized response per-user for 1 hour, but
nothing ever invalidated that cache when the underlying signals changed:
setting onboarding preferences, viewing/renting/buying/reviewing a book,
marking something finished. A user's cold-start snapshot would get cached
on first visit and then stay frozen no matter what they did afterward —
reading as "personalization doesn't work." Fixed by invalidating the cache
in `updatePreferences` and in the shared `logActivity` utility (the single
choke point every activity signal already flows through). Verified live:
picking genres during onboarding now immediately changes the homepage.

## 📦 Phase 5 — Seller Portal

- Listing approval auto-creates a real seller-owned `Book` (condition,
  seller-set pricing), auto-promotes the user to `isSeller: true`,
  reconciling the two previously-separate "become a seller" concepts.
- Seller dashboard: inventory management, per-seller order view, revenue/
  commission math (10% flat, documented as illustrative), payout requests
  with server-recomputed balance (never trusts a client-submitted amount),
  per-book performance (views/wishlists/purchases).
- Admin: payout approval queue.
- Verified end-to-end with a real simulated paid order (manually-computed
  Razorpay HMAC signature — the live payment widget is never touched by
  automated testing) confirming the full revenue → payout-request →
  admin-resolve cycle.

## 🛠️ Phase 4 — Admin Portal

- Dashboard metrics, seller application approval/rejection (with email),
  book CRUD + CSV bulk import, sell-listing moderation, order management
  (status updates, refunds), damage report resolution, user
  suspend/reinstate (blocks login and active sessions), user activity
  viewer.
- Fixed a real bug found via the admin Orders page: several order-mutation
  endpoints (`cancelOrder`, `returnItem`, `extendRental`, `reportDamage`,
  `verifyPayment`, admin's `updateOrderStatus`/`refundOrder`) were returning
  unpopulated documents, showing "Unknown ()" for the buyer/book after any
  action. Fixed by populating before every response.

## 💳 Phase 2 — Commerce

- Real Razorpay integration (raw `fetch`, no SDK): order creation, HMAC
  payment-signature verification, webhook signature verification, refunds.
- Rental lifecycle: due dates, extensions (with their own payment step),
  late fees, returns, damage reports.
- Address book.
- "Never trust the client" applied throughout: payment amounts and seller
  payout balances are always re-derived server-side.

## 🚀 Phase 1 — Production-Ready Core

- Real auth: refresh-token rotation with atomic replay detection, email
  verification, password reset, session list/revoke, Google/GitHub OAuth
  (manual token exchange, no SDK — see today's diagnosis above for the
  Google redirect-URI issue).
- AI-backed homepage personalization: embeddings (Book title+author+
  description+tags), MongoDB Atlas Vector Search with an in-process
  cosine-similarity fallback, taste-vector recommendations, "Because You
  Read X", natural-language AI search with hard structured filters
  (price/category/rating) plus semantic re-ranking.
- AI book summaries and AI review-sentiment analysis, both computed once and
  cached on the `Book` document, not regenerated per request.
- Reading dashboard (streak, calendar, money saved) and sustainability
  impact estimates.

---

## ⚠️ Known issues requiring your action (not fixable in code)

1. ~~**Groq API key invalid**~~ — resolved 2026-08-28, user regenerated the key.
2. ~~**Cloudinary credentials invalid**~~ — resolved 2026-08-28, user fixed the
   `cloud_name`.
3. ~~**Google OAuth redirect URI not registered**~~ — resolved earlier in the
   2026-08-28 session; login verified working end-to-end.
4. **Razorpay QR Codes API not provisioned** on the current test account —
   the code doesn't call it today (`utils/razorpay.ts` only uses the Orders
   and Refunds APIs; checkout goes through the standard widget), so this is
   only needed if a standalone-QR payment flow gets built later. If/when
   requesting provisioning, only **"Create a QR Code"** is load-bearing —
   Close/Fetch/Fetch-by-customer/Fetch-by-payment are supporting reads
   around a QR you've already created, not separate capabilities.
5. ~~**MongoDB Atlas connectivity**~~ — root-caused 2026-08-28: Atlas was
   rejecting this machine's drifted dynamic IP, surfaced misleadingly as an
   SSL alert. Resolution is allowlisting the current IP under Atlas →
   Network Access whenever it drifts (see the 2026-08-28 root-cause entry
   above for detail); `config/db.ts` also now retries with backoff instead
   of crashing on the first failed handshake.

## 🔭 Future changes (not yet started)

From `future.md`, still open:
- **Phase 3 (AI Features)** — most of the embedding/search/summary pieces
  already shipped under Phase 1 above, but not yet built: AI OCR book-cover
  upload (auto-fill a sell listing from a photo), AI chat assistant with
  tool-calling, AI duplicate-listing detection, AI cover-quality check,
  voice search (Whisper transcription → existing search flow).
- **Phase 11** — real product analytics (PostHog/GA4/Mixpanel) once an
  account exists.
- **Phase 12** — dark mode, React Native app, i18n/multi-currency.
- **Stretch goals** — book exchange/donation, library management mode,
  public API, university partnerships, enterprise plans. Per the roadmap's
  own guidance, these should wait for real usage data rather than being
  built speculatively.

---

## ✅ Complete — Frontend ↔ Backend wiring (original)

### Backend
- **All models** (`Book`, `Category`, `Plan`, `Review`, `Order`, `Listing`, `User`):
  added a shared `toJSON` transform (`src/models/schemaOptions.ts`) so API
  responses return a clean `id` string field instead of Mongo's `_id`/`__v`,
  matching the frontend's TypeScript types exactly.
- `tsconfig.json`: added `ignoreDeprecations: "6.0"` to keep the config
  forward-compatible with newer TypeScript releases.

### Frontend — Types
- `src/types/index.ts`: changed all `id` fields from `number` → `string` (to
  match MongoDB ObjectIds). Added new `Order`, `OrderItem`, `Listing`,
  `ListingStatus`, `ListingCondition` types for the checkout and
  sell-a-book flows.

### Frontend — New files
- `src/services/apiClient.ts` — shared `fetch` wrapper: base URL from
  `VITE_API_URL`, attaches `Authorization: Bearer <token>` automatically,
  throws a typed `ApiClientError` with the backend's validation messages.
- `src/vite-env.d.ts` — typing for `import.meta.env.VITE_API_URL`.
- `.env` / `.env.example` — `VITE_API_URL=http://localhost:5000/api`.
- `src/services/reviewService.ts`, `categoryService.ts`, `planService.ts`,
  `cartService.ts`, `wishlistService.ts`, `orderService.ts`,
  `listingService.ts` — one file per backend resource.
- `src/hooks/useBooks.ts`, `useBook.ts`, `useCategories.ts`, `usePlans.ts` —
  data-fetching hooks with loading/error state, used by pages instead of
  importing static arrays.

### Frontend — Rewritten
- `src/services/bookService.ts` — calls `GET /books` (search/category/sort/
  pagination), `GET /books/:id`, `GET /books/:id/similar`.
- `src/services/authService.ts` — calls `/auth/login`, `/auth/register`,
  `/auth/me`, `/auth/logout`; stores the JWT via `apiClient`.
- `src/context/AuthContext.tsx` — no longer persists a fake user object in
  localStorage. On load, if a token exists it's validated against
  `GET /auth/me`; invalid/expired tokens are cleared silently.
- `src/context/CartContext.tsx` / `WishlistContext.tsx` — **hybrid** approach:
  - Guests: unchanged, still backed by `localStorage`.
  - Logged in: on login, the server cart/wishlist is fetched and replaces
    local state; every subsequent add/remove/update also fires a best-effort
    (fire-and-forget) call to the matching backend endpoint, so the UI never
    blocks on network latency.
- `src/pages/BookDetails.tsx` — fetches the book + similar books via
  `useBook(id)`, reviews via `reviewService`, shows a loading state, and
  wires the "Write a Review" form to `POST /books/:id/reviews`.
- `src/components/book/BookReviews.tsx` — inline review submission form
  (rating + comment) for logged-in users, with a "Log in to write a review"
  prompt for guests.
- `src/components/home/TrendingBooks.tsx` — category filter chips + book grid
  now come from `useBooks()` / `useCategories()` instead of static data.
- `src/components/home/PopularCategories.tsx` — categories from `useCategories()`.
- `src/pages/Categories.tsx` — full search/filter/sort/pagination against
  `GET /books`, category chips from `useCategories()`.
- `src/pages/Rent.tsx` — search + category filter from `useBooks()` / `useCategories()`.
- `src/pages/Sell.tsx` — real controlled form wired to
  `listingService.createListing`; requires login (shows a "Log in to sell"
  prompt for guests instead of the form); category dropdown from `useCategories()`.
- `src/pages/Plans.tsx` — plans from `usePlans()`.
- `src/pages/Cart.tsx` / `src/components/cart/CartSummary.tsx` — "Proceed to
  Checkout" now calls `orderService.checkout()`, then clears the cart.
- `src/pages/Profile.tsx` — rental/purchase history now comes from
  `orderService.fetchMyOrders()` instead of hardcoded sample data.

### Removed
- `src/data/books.ts`, `categories.ts`, `plans.ts`, `reviews.ts` — no longer
  needed now that every page/component fetches from the live API.

### Verified
- `npx tsc -b --noEmit` — ✅ no errors (frontend)
- `npx eslint src --ext .ts,.tsx` — ✅ no errors or warnings (frontend)
- Backend `tsc` can't be fully verified in this sandbox (no network access to
  `npm install`), but every reported diagnostic is a "cannot find module X"
  for a package already declared in `package.json` — i.e. purely a missing
  `node_modules`, not a code defect. Run `npm install && npm run build` in
  `lookbook-backend` to confirm on your machine.


