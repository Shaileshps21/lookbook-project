# LookBook — Full Implementation Plan
## 10 Features + Profile Redesign

> **User decisions confirmed:**
> - ✅ GitHub OAuth button → **Re-add** to Login & Register pages  
> - ✅ Avatar upload → **Cloudinary** (same flow as book cover uploads)

---

## Overview — What We're Building

| # | Feature | Backend | Frontend | Priority |
|---|---|---|---|---|
| 1 | Remember Me on Login | ✅ Small change | ✅ Checkbox | P1 |
| 2 | GitHub OAuth UI | ❌ None (backend ready) | ✅ Add button back | P1 |
| 3 | Recharts Reading Dashboard | ❌ None (data already exists) | ✅ Install + charts | P2 |
| 4 | Extend Rental UI | ❌ None (backend ready) | ✅ Button + modal | P2 |
| 5 | Pickup Scheduling UI | ✅ New endpoint | ✅ Date/slot picker | P3 |
| 6 | Coupon System | ✅ Full new feature | ✅ Admin + Cart UI | P3 |
| 7 | Follow Feed Page | ❌ Verify endpoint | ✅ New `/feed` route | P2 |
| 8 | Profile Page Redesign | ✅ Edit profile + change password | ✅ Full tab layout | P1 |
| 9 | Email Notification Preferences | ✅ Schema + endpoints | ✅ Toggle UI | P3 |
| 10 | Club Shareable Invite Links | ✅ Token generation | ✅ Share button + join flow | P2 |

---

---

## Feature 1 — "Remember Me" Checkbox on Login

### What it does
When the user unchecks "Remember me," the refresh token expires in **1 day** instead of 30 days. The session still works; it just expires sooner if they don't return.

### Backend Changes

#### [MODIFY] `authController.ts`
- In the `login` handler, read `rememberMe: boolean` from `req.body` (default `true`).
- Compute `refreshExpiry = rememberMe ? "30d" : "1d"`.
- Pass `refreshExpiry` to whatever utility signs the refresh token (`authSession.ts`).

#### [MODIFY] `authSession.ts`
- Accept an optional `expiresIn` parameter on `issueRefreshToken` (default `"30d"`).
- Pass it to `jwt.sign` and store the matching `expiresAt` on the `RefreshToken` document.

#### [MODIFY] `authValidators.ts`
- Add optional `rememberMe: z.boolean().optional().default(true)` to `loginSchema`.

### Frontend Changes

#### [MODIFY] `Login.tsx`
- Add a styled checkbox below the password field:
  ```
  ☐  Remember me for 30 days
  ```
- State: `const [rememberMe, setRememberMe] = useState(true)`.
- Pass `rememberMe` in the login payload.

#### [MODIFY] `authService.ts`
- `login(email, password, rememberMe)` — forward the flag in the request body.

### Files Touched
```
lookbook-backend/src/controllers/authController.ts
lookbook-backend/src/utils/authSession.ts
lookbook-backend/src/validators/authValidators.ts
lookbook-frontend/src/pages/Login.tsx
lookbook-frontend/src/services/authService.ts
```

---

---

## Feature 2 — GitHub OAuth UI Button (Re-add)

### What it does
The full GitHub OAuth backend flow (routes, controller, token exchange) was never removed. Only the two UI buttons in `Login.tsx` and `Register.tsx` were removed. This simply restores them.

### Backend Changes
**None.** `GET /api/auth/github` and `GET /api/auth/github/callback` are fully operational.

### Frontend Changes

#### [MODIFY] `Login.tsx`
- Import `GithubIcon` from `SocialIcons.tsx` (already exported, just unused).
- Add back the "Continue with GitHub" button in the OAuth section alongside the Google button.
- The `oauthUrls.github` constant still exists in the service — just reference it.

#### [MODIFY] `Register.tsx`
- Same: add "Sign up with GitHub" button in the OAuth section.

### Note
The GitHub OAuth button will only work end-to-end in production where the callback URL is registered in GitHub's OAuth App settings. In dev, it works on `localhost:5000`. Redirect URI to register: `https://lookbook-backend.onrender.com/api/auth/github/callback`.

### Files Touched
```
lookbook-frontend/src/pages/Login.tsx
lookbook-frontend/src/pages/Register.tsx
```

---

---

## Feature 3 — Recharts Reading Dashboard

### What it does
Replaces the current plain-CSS Reading Dashboard with proper interactive charts using Recharts. Three new chart types:
1. **Activity AreaChart** — reading activity over the last 90 days (reuses existing calendar data from `GET /users/me/reading-stats`)
2. **Monthly BarChart** — books finished per month (last 12 months)
3. **Genre PieChart** — favourite genres breakdown from order history

### Backend Changes

#### [MODIFY] `userController.ts` → `getReadingStats`
- Add `monthlyBooks: { month: string, count: number }[]` to the response — last 12 months of "finished" activities grouped by month. This is a simple MongoDB aggregation on `UserActivity` filtered by `action: "finished"`.
- The `calendar` array and `streak` already exist.

### Frontend Changes

#### Install Recharts
```bash
cd lookbook-frontend
npm install recharts
```

#### [MODIFY] `ReadingDashboard.tsx`
Complete rewrite of the charting section:

```
ReadingDashboard
├── Header: "My Reading Journey" + streak badge
├── Stats row: Books Read · Money Saved · Streak · Fav Genre
├── AreaChart: "Reading Activity (Last 90 Days)"
│   └── X: date, Y: activity count (1 or 0), filled area
├── BarChart: "Books Finished Per Month"
│   └── X: month label, Y: count, amber bars
├── PieChart: "Favourite Genres"
│   └── Pie slices per genre from order history
└── GitHub-style heatmap grid (KEEP — Recharts has no built-in heatmap)
    └── 90-day calendar, existing plain CSS is fine here
```

All charts use `<ResponsiveContainer width="100%" height={220}>` so they scale correctly on mobile without fixed pixel widths.

### Files Touched
```
lookbook-frontend/package.json  (recharts added)
lookbook-frontend/src/components/profile/ReadingDashboard.tsx
lookbook-backend/src/controllers/userController.ts  (monthlyBooks added)
lookbook-backend/src/routes/userRoutes.ts  (if needed)
lookbook-frontend/src/services/userService.ts  (update type for response)
```

---

---

## Feature 4 — Extend Rental UI in Order History

### What it does
Active rental items in the Order History now have an **"Extend Rental"** button. Clicking it shows a modal with the prorated fee quote and a new due date. Confirming triggers the same Razorpay payment flow as a regular checkout.

### Backend
**No new endpoints needed.** The backend already has the rental extension logic in `orderController.ts`. If a `GET /orders/:id/extend-quote` endpoint doesn't already exist as a separate quote endpoint, it can be derived from the existing extend logic.

> **Check first:** Run `grep -r "extend" lookbook-backend/src/routes/ ` to confirm whether a quote endpoint exists. If not, add one that returns the fee without charging.

#### [MODIFY] `orderController.ts`
- Add `extendQuote` handler: computes `proratedFee` and `newDueDate` without creating a payment — dry-run of the extend logic.

#### [MODIFY] `orderRoutes.ts`
- `GET /orders/:id/items/:itemId/extend-quote` → `extendQuote`

### Frontend Changes

#### [MODIFY] `OrderHistory.tsx`
- For each `OrderItem` where `mode === "Rent"` and parent order `status === "Active"`:
  - Show an **"Extend Rental"** button (amber outline, small) next to the due date.
  - On click → fetch the quote → open `ExtendRentalModal`.

#### [NEW] `ExtendRentalModal.tsx`
```
ExtendRentalModal
├── Book title + current due date
├── "New due date: [computed date]"
├── "Prorated fee: ₹[amount]"
├── Cancel | Confirm & Pay buttons
└── On Confirm → opens Razorpay widget → verifyPayment → reload orders
```

#### [MODIFY] `orderService.ts`
- Add `fetchExtendQuote(orderId, itemId)` → `GET /orders/:orderId/items/:itemId/extend-quote`

### Files Touched
```
lookbook-backend/src/controllers/orderController.ts
lookbook-backend/src/routes/orderRoutes.ts
lookbook-frontend/src/components/profile/OrderHistory.tsx
lookbook-frontend/src/components/profile/ExtendRentalModal.tsx  [NEW]
lookbook-frontend/src/services/orderService.ts
```

---

---

## Feature 5 — Pickup Scheduling UI

### What it does
When a user requests a return, they can schedule a pickup: choose a date (within the next 7 days) and a time slot (Morning / Afternoon / Evening). This is stored on the order. A real courier API (Shiprocket) would be called here once the API key exists — for now it stores the slot and notifies via in-app notification.

### Backend Changes

#### [MODIFY] `Order.ts` (model)
- The `tracking` object on `OrderItem` likely already has `pickupSlot` (added by the admin tracking editor). Confirm it has:
  ```typescript
  pickupDate?: Date;
  pickupSlot?: "morning" | "afternoon" | "evening";
  pickupScheduledAt?: Date;
  ```
  If not, add these three fields.

#### [NEW] `orderController.ts` → `schedulePickup` handler
```typescript
POST /orders/:id/items/:itemId/schedule-pickup
body: { pickupDate: string (ISO), pickupSlot: "morning" | "afternoon" | "evening" }
```
- Validates the date is within the next 7 days and in the future.
- Sets `pickupDate`, `pickupSlot`, `pickupScheduledAt` on the matching item.
- Sends an in-app notification to the user confirming the pickup.

#### [MODIFY] `orderRoutes.ts`
- Add `POST /:id/items/:itemId/schedule-pickup` → `protect, schedulePickup`

### Frontend Changes

#### [MODIFY] `OrderHistory.tsx`
- For items in a return-requested state (or any `Active` rental), show a **"Schedule Pickup"** link.
- On click → open `SchedulePickupModal`.

#### [NEW] `SchedulePickupModal.tsx`
```
SchedulePickupModal
├── "Schedule your book pickup"
├── Date picker: next 7 available days (Mon–Sat, no Sunday)
│   └── Rendered as a row of 7 day-chips
├── Time slot: [Morning 9am–12pm] [Afternoon 12pm–4pm] [Evening 4pm–7pm]
├── Cancel | Confirm Pickup buttons
└── On confirm → POST to endpoint → show success toast
```

### Files Touched
```
lookbook-backend/src/models/Order.ts
lookbook-backend/src/controllers/orderController.ts
lookbook-backend/src/routes/orderRoutes.ts
lookbook-frontend/src/components/profile/OrderHistory.tsx
lookbook-frontend/src/components/profile/SchedulePickupModal.tsx  [NEW]
lookbook-frontend/src/services/orderService.ts
```

---

---

## Feature 6 — Coupon System

### What it does
- **Admin:** Create, edit, deactivate, and view usage of coupon codes.
- **User:** Enter a coupon code at checkout; see the discount applied to the order total before paying.
- **Backend:** Validates the code, checks min order value, usage limit, and expiry. Discount is computed server-side — never trusted from the client.

### Backend Changes

#### [NEW] `Coupon.ts` (model)
```typescript
{
  code: string;          // unique, uppercase, e.g. "BOOK20"
  discountType: "percent" | "flat";
  discountValue: number; // e.g. 20 (%) or 50 (₹)
  minOrderValue: number; // minimum cart total to apply (default 0)
  maxUses: number;       // 0 = unlimited
  usedCount: number;     // incremented on each successful use
  expiresAt?: Date;
  active: boolean;       // admin can toggle off
  createdAt: Date;
}
```
Indexes: `{ code: 1 }` unique, `{ active: 1, expiresAt: 1 }`.

#### [NEW] `couponController.ts`
- `GET /admin/coupons` — list all coupons with usage stats
- `POST /admin/coupons` — create a new coupon (Zod-validate all fields)
- `PATCH /admin/coupons/:id` — update / toggle active
- `DELETE /admin/coupons/:id` — soft delete (set `active: false`)
- `POST /coupons/validate` — **public, auth-protected** — given `{ code, cartTotal }`, return `{ valid, discountAmount, finalTotal, message }`. Does NOT increment `usedCount` — only validates.

#### [MODIFY] `orderController.ts` → `checkout`
- Accept optional `couponCode?: string` in checkout body.
- If present: validate the coupon (same logic as `/coupons/validate`), compute `discountAmount`, subtract from the Razorpay order amount.
- On successful payment webhook: increment `coupon.usedCount` via `findOneAndUpdate`.
- Store `couponCode` and `discountAmount` on the `Order` document.

#### [MODIFY] `Order.ts`
- Add `couponCode?: string` and `discountAmount: number` (default 0) to the schema.

#### [NEW] `couponRoutes.ts`
```
GET  /admin/coupons
POST /admin/coupons
PATCH /admin/coupons/:id
DELETE /admin/coupons/:id
POST /coupons/validate    (protect — logged-in users only)
```

### Frontend Changes

#### [NEW] `AdminCoupons.tsx` (page at `/admin/coupons`)
```
AdminCoupons
├── Page header: "Coupons" + "Create Coupon" button
├── Stats bar: Total · Active · Total uses this month
├── Coupon table:
│   ├── Code | Type | Value | Min Order | Uses | Expires | Status | Actions
│   └── Actions: Edit · Toggle active · Delete
└── Create/Edit modal:
    ├── Code (auto-uppercase)
    ├── Discount type: Percent | Flat (₹)
    ├── Discount value
    ├── Min order value
    ├── Max uses (0 = unlimited)
    ├── Expiry date (optional)
    └── Save button
```

#### [MODIFY] `AdminDashboard.tsx`
- Add "Coupons" link in the admin sidebar navigation.

#### [MODIFY] `Cart.tsx` + `CartSummary.tsx`
```
CartSummary
├── ... existing items ...
├── [Coupon Code input]  [Apply] button
│   ├── On Apply → POST /coupons/validate
│   ├── Success: show "🎉 BOOK20 applied — ₹50 off!" in green
│   ├── Error: show reason ("Minimum order ₹299 required")
│   └── Applied coupon shows with an ✕ to remove
├── Subtotal: ₹XXX
├── Discount (BOOK20): -₹50         ← only shown if coupon applied
├── Total: ₹XXX
└── Proceed to Checkout (passes couponCode to checkout call)
```

#### [MODIFY] `orderService.ts`
- `checkout(address, provider, couponCode?)` — forward the coupon code.

### Files Touched
```
lookbook-backend/src/models/Coupon.ts  [NEW]
lookbook-backend/src/controllers/couponController.ts  [NEW]
lookbook-backend/src/routes/couponRoutes.ts  [NEW]
lookbook-backend/src/controllers/orderController.ts
lookbook-backend/src/models/Order.ts
lookbook-backend/src/routes/index.ts  (register coupon routes)
lookbook-frontend/src/pages/admin/AdminCoupons.tsx  [NEW]
lookbook-frontend/src/components/cart/CartSummary.tsx
lookbook-frontend/src/pages/Cart.tsx
lookbook-frontend/src/services/orderService.ts
lookbook-frontend/src/services/couponService.ts  [NEW]
```

---

---

## Feature 7 — Follow Feed Page (`/feed`)

### What it does
A dedicated social feed page showing activity from users you follow: recent reviews they posted, shelves they updated, books they marked as read. Think a minimal Twitter/Goodreads feed for your reading circle.

### Backend
Verify `GET /users/feed` exists. If not:

#### [MODIFY/NEW] `userController.ts` → `getFeed`
```typescript
GET /users/me/feed?page=1&limit=20
```
- Find all `userId`s the current user follows (from `Follow` collection).
- Query `Review` for recent reviews by those users + `UserActivity` for `finished`/`reading` actions by those users.
- Merge, sort by `createdAt desc`, paginate.
- Populate: `user.name`, `user.avatar`, `book.title`, `book.image`.
- Return a unified feed array: `{ type: "review"|"activity", user, book, content?, rating?, action?, createdAt }`.

#### [MODIFY] `userRoutes.ts`
- Add `GET /me/feed` → `protect, getFeed`

### Frontend Changes

#### [NEW] `Feed.tsx` (page at `/feed`)
```
Feed
├── Header: "Your Reading Feed"
├── If no one followed: EmptyState — "Follow readers to see their activity"
├── Feed items (infinite scroll or paginated):
│   ├── Review card: [Avatar] [Name] reviewed [Book title] ★★★★☆
│   │   └── Shows review excerpt + "View full review" link
│   └── Activity card: [Avatar] [Name] finished reading [Book title]
│       └── Shows completion date
└── Sidebar: "Who to follow" suggestions (top readers by review count)
```

#### [MODIFY] `Navbar.tsx`
- Add "Feed" link (BookOpen icon) between "Clubs" and "Profile" links. Visible only to logged-in users.

#### [MODIFY] `userService.ts`
- Add `fetchMyFeed(page)` → `GET /users/me/feed`

### Files Touched
```
lookbook-backend/src/controllers/userController.ts
lookbook-backend/src/routes/userRoutes.ts
lookbook-frontend/src/pages/Feed.tsx  [NEW]
lookbook-frontend/src/components/common/Navbar.tsx
lookbook-frontend/src/services/userService.ts
lookbook-frontend/src/App.tsx  (add /feed route)
```

---

---

## Feature 8 — Profile Page Complete Redesign

This is the largest UI change. The profile page transforms from a single scroll page into a **tabbed dashboard** that is significantly easier to navigate.

### New Structure

```
Profile.tsx  (new layout)
├── ProfileHeader.tsx  [NEW]   ← replaces ProfileSidebar
│   ├── Cover banner (gradient)
│   ├── Avatar (large, with Cloudinary upload on click)
│   ├── Name + email
│   ├── Badges: Verified Reader · Seller · Admin
│   ├── Quick stats: Books Read · Rentals · Following · Reviews
│   └── Action buttons: Edit Profile · Admin Panel · Seller Dashboard
├── EmailVerificationBanner (inline, below header)
└── Tab bar:
    ├── Overview
    ├── Orders
    ├── Reading
    ├── Community
    ├── Addresses
    └── Security
```

### Tab Contents

| Tab | Components inside |
|---|---|
| **Overview** | `ProfileStats` + reading streak widget + recent order (1 entry) + sustainability badge |
| **Orders** | Full `OrderHistory` + filter tabs (All / Rentals / Purchases) |
| **Reading** | Full `ReadingDashboard` (with new Recharts, from Feature 3) |
| **Community** | `CommunitySettings` (follow counts, public profile toggle, shelves list) |
| **Addresses** | `AddressBook` |
| **Security** | `TwoFactorSettings` + `SessionsList` + `ChangePasswordForm` [NEW] |

---

### Backend Changes

#### [MODIFY] `userController.ts`
- **New:** `PATCH /users/me` — update `name` and/or `avatar`.
  - `name`: trim, max 80 chars.
  - `avatar`: a Cloudinary URL string (frontend uploads the file to Cloudinary directly via the existing upload endpoint, gets back the URL, then PATCH sends only the URL — the backend never handles the binary).
  - After update, return the sanitized user object so `AuthContext` can update.
- **New:** `PATCH /auth/change-password`
  - Body: `{ currentPassword, newPassword }`.
  - Validate `currentPassword` against stored hash (`comparePassword`).
  - Hash and save `newPassword`.
  - Invalidate all `RefreshToken` documents for this user (force re-login everywhere).
  - Return 200 with a message — frontend should call `logout()` after this.

#### [MODIFY] `userRoutes.ts` / `authRoutes.ts`
- `PATCH /users/me` → `protect, updateMe`
- `PATCH /auth/change-password` → `protect, changePassword`

---

### Frontend Changes

#### [NEW] `ProfileHeader.tsx`
```tsx
ProfileHeader
├── Cover: gradient banner (amber-to-rose) — static for now, can be user-set later
├── Avatar circle:
│   ├── Shows user.avatar (Cloudinary URL) if set, else first-letter gradient
│   └── Camera icon overlay on hover → opens file picker → uploads → PATCH /users/me
├── Name: user.name  (bold, large)
├── Email: user.email  (muted)
├── Badge row:
│   ├── "✓ Verified" (green) — if emailVerified
│   ├── "📚 Seller" (amber) — if isSeller
│   └── "🛡 Admin" (red) — if role === "admin"
├── Stats strip: [Books Read] [Active Rentals] [Following] [Reviews Given]
└── Action buttons:
    ├── "Edit Profile" → opens EditProfileModal
    ├── "Admin Panel" → Link to /admin  (if admin)
    └── "Seller Dashboard" → Link to /seller  (if isSeller)
```

#### [NEW] `EditProfileModal.tsx`
```tsx
EditProfileModal
├── Avatar upload section:
│   ├── Current avatar (large preview)
│   ├── "Upload new photo" button → file input (image/*)
│   ├── On file selected: POST /upload (existing Cloudinary endpoint) → get URL back
│   └── Preview the new avatar before saving
├── Name field (controlled input, max 80 chars)
├── Cancel | Save Changes buttons
└── On save: PATCH /users/me → update AuthContext user → close modal
```

#### [NEW] `ChangePasswordForm.tsx` (inside Security tab)
```tsx
ChangePasswordForm
├── Section heading: "Change Password"
├── Current Password field (with eye toggle — reuses FormField component)
├── New Password field (eye toggle + strength indicator)
├── Confirm New Password field
├── "Update Password" button (with loading state)
└── On success: show "Password changed. You'll be logged out of all devices." → logout()
```

#### [MODIFY] `Profile.tsx` — full rewrite
```tsx
Profile.tsx
├── Import ProfileHeader, tabs
├── Tab state: useState("overview")
├── Render ProfileHeader
├── Render EmailVerificationBanner (if !emailVerified)
├── Tab bar (6 tabs with icons)
└── Tab content area (render matching component for active tab)
```

#### [MODIFY] `userService.ts`
- `updateMe({ name?, avatar? })` → `PATCH /users/me`
- `changePassword({ currentPassword, newPassword })` → `PATCH /auth/change-password`

### Files Touched
```
lookbook-backend/src/controllers/userController.ts
lookbook-backend/src/controllers/authController.ts
lookbook-backend/src/routes/userRoutes.ts
lookbook-backend/src/routes/authRoutes.ts
lookbook-frontend/src/pages/Profile.tsx  [REWRITE]
lookbook-frontend/src/components/profile/ProfileHeader.tsx  [NEW]
lookbook-frontend/src/components/profile/EditProfileModal.tsx  [NEW]
lookbook-frontend/src/components/profile/ChangePasswordForm.tsx  [NEW]
lookbook-frontend/src/services/userService.ts
lookbook-frontend/src/services/authService.ts
```

---

---

## Feature 9 — Email Notification Preferences

### What it does
Users can toggle which types of emails they receive. All preferences default to `true` (opt-in). Toggling in the Security tab saves instantly.

### Backend Changes

#### [MODIFY] `User.ts` (model)
Add `emailPreferences` embedded sub-document:
```typescript
emailPreferences: {
  orderUpdates: boolean;      // "Your order has shipped" etc
  rentalReminders: boolean;   // Due-date reminder emails
  priceDropAlerts: boolean;   // Wishlisted book price dropped
  sellerNotifications: boolean; // Payout approved, listing moderated
  marketing: boolean;         // Platform newsletters / new features
}
```
All fields default to `true`.

#### [MODIFY] `userController.ts`
- `PATCH /users/me/email-preferences` — accepts partial object, merges with existing prefs.

#### [MODIFY] `mailer.ts`
- Before sending each email type, load the user's `emailPreferences` and check the relevant flag. If `false`, skip the send silently (still log it server-side).
- Map: `orderUpdates` → order confirmation, return confirmed, refund; `rentalReminders` → due-date reminders; `priceDropAlerts` → price drop; `sellerNotifications` → seller approval/rejection, payout.

#### [MODIFY] `userRoutes.ts`
- `PATCH /users/me/email-preferences` → `protect, updateEmailPreferences`

### Frontend Changes

#### [MODIFY] `SecurityTab` (inside the new Profile tabs, or as `NotificationsSection.tsx`)
Add an "Email Notifications" section with toggle switches:

```
Email Notifications
├── Order updates (confirmations, refunds, tracking)    [Toggle ON/OFF]
├── Rental reminders (due-date alerts)                  [Toggle ON/OFF]
├── Price drop alerts (for wishlisted books)            [Toggle ON/OFF]
├── Seller notifications (payouts, listing updates)     [Toggle ON/OFF]
└── Marketing emails (new features, newsletters)        [Toggle ON/OFF]
```

Each toggle calls `PATCH /users/me/email-preferences` on change (debounced 500ms, optimistic UI).

#### [MODIFY] `userService.ts`
- `updateEmailPreferences(prefs: Partial<EmailPreferences>)` → `PATCH /users/me/email-preferences`

### Files Touched
```
lookbook-backend/src/models/User.ts
lookbook-backend/src/controllers/userController.ts
lookbook-backend/src/routes/userRoutes.ts
lookbook-backend/src/utils/mailer.ts
lookbook-frontend/src/components/profile/NotificationsSection.tsx  [NEW]
lookbook-frontend/src/services/userService.ts
lookbook-frontend/src/types/index.ts  (add EmailPreferences type)
```

---

---

## Feature 10 — Club Shareable Invite Links

### What it does
Every club gets a **unique shareable invite link** (e.g. `https://lookbook.app/clubs/join/abc123xyz`). The club owner can:
- Copy the link with one click.
- Share it via WhatsApp / copy-paste / QR code.
- Regenerate the link (invalidates the old one).

Anyone visiting the link:
- If **not logged in** → redirected to login, then back to the invite link.
- If **logged in** → shown a "Join [Club Name]" page with club info and a Join button.
- If **already a member** → shown "You're already a member" with a "Go to Club" button.

### Backend Changes

#### [MODIFY] `Club.ts` (model)
Add:
```typescript
inviteToken: string;   // unique random token, indexed
inviteEnabled: boolean; // owner can disable the link
```
- On club creation, auto-generate an invite token: `crypto.randomBytes(16).toString("hex")`.
- Index: `{ inviteToken: 1 }` unique + sparse.

#### [MODIFY] `clubController.ts`
- **`createClub`**: generate and store `inviteToken` on creation.
- **New `joinByInvite`**: `POST /clubs/invite/:token/join`
  - Find club by `inviteToken` where `inviteEnabled: true`.
  - If not found/disabled → 404 "Invite link is invalid or has been disabled."
  - If already a member → 200 with `{ alreadyMember: true }`.
  - Else → add user to members, save, respond with populated club.
- **New `getClubByInvite`**: `GET /clubs/invite/:token` (public — no auth)
  - Returns `{ id, name, description, memberCount, book, owner.name }` — enough to render the join preview page.
- **New `regenerateInvite`**: `POST /clubs/:id/regenerate-invite` (owner only)
  - Generates a new `inviteToken`, invalidating the old link.
- **New `toggleInvite`**: `PATCH /clubs/:id/invite-enabled` (owner only)
  - Toggles `inviteEnabled` on/off.

#### [MODIFY] `clubRoutes.ts`
```
GET  /clubs/invite/:token          → getClubByInvite (public)
POST /clubs/invite/:token/join     → protect, joinByInvite
POST /clubs/:id/regenerate-invite  → protect, regenerateInvite
PATCH /clubs/:id/invite-enabled    → protect, toggleInvite
```

### Frontend Changes

#### [NEW] `ClubInvite.tsx` (page at `/clubs/join/:token`)
```
ClubInvite
├── Loading state while fetching club info by token
├── If club not found: "This invite link is invalid or has been disabled."
├── Club info card:
│   ├── Book cover (if linked to a book)
│   ├── Club name (large)
│   ├── Description
│   ├── Owner: "Created by [Name]"
│   └── Members: "[N] members"
├── If NOT logged in:
│   └── "Sign in to join this club" → Login button (redirects back to /clubs/join/:token)
├── If logged in + already a member:
│   └── "You're already a member! → Go to Club" button
└── If logged in + not a member:
    └── "Join [Club Name]" primary button → POST /clubs/invite/:token/join → redirect to /clubs/:id
```

#### [MODIFY] `ClubDetail.tsx` — add invite management section
For the club owner, add an **"Invite Members"** section below the member list:

```
Invite Members
├── Invite link: [https://lookbook.app/clubs/join/abc123...] [Copy 📋]
├── Share via: [WhatsApp] [Copy Link] [QR Code]  (3 action chips)
├── Link enabled toggle: [ON/OFF]  (disables the link without deleting it)
└── [Regenerate Link] button (with confirm dialog — "This will break the old link")
```

The **QR Code** is generated client-side using a tiny library (`qrcode` — ~12KB) and shown in a modal. No server round-trip needed.

#### [MODIFY] `Clubs.tsx` — add "Share" button on club cards
Each club card that the current user **owns** gets a share icon button that copies the invite link.

#### [MODIFY] `clubService.ts`
- `fetchClubByInviteToken(token)` → `GET /clubs/invite/:token`
- `joinByInviteToken(token)` → `POST /clubs/invite/:token/join`
- `regenerateInviteLink(clubId)` → `POST /clubs/:id/regenerate-invite`
- `toggleInviteEnabled(clubId, enabled)` → `PATCH /clubs/:id/invite-enabled`

#### [MODIFY] `App.tsx`
- Add route: `/clubs/join/:token` → `<ClubInvite />`

### Files Touched
```
lookbook-backend/src/models/Club.ts
lookbook-backend/src/controllers/clubController.ts
lookbook-backend/src/routes/clubRoutes.ts
lookbook-frontend/src/pages/ClubInvite.tsx  [NEW]
lookbook-frontend/src/pages/ClubDetail.tsx
lookbook-frontend/src/pages/Clubs.tsx
lookbook-frontend/src/services/clubService.ts
lookbook-frontend/src/App.tsx
lookbook-frontend/package.json  (add qrcode + @types/qrcode)
```

---

---

## Recommended Build Order

```
Week 1 — Profile Foundation
  ├── Feature 8  (Profile redesign — tab layout + ProfileHeader)
  ├── Feature 8  (Edit Profile modal + PATCH /users/me)
  └── Feature 8  (Change Password form + PATCH /auth/change-password)

Week 2 — Auth + Dashboard
  ├── Feature 1  (Remember Me checkbox)
  ├── Feature 2  (GitHub OAuth button re-add)
  └── Feature 3  (Recharts Reading Dashboard)

Week 3 — Commerce
  ├── Feature 4  (Extend Rental UI)
  ├── Feature 5  (Pickup Scheduling UI)
  └── Feature 9  (Email Notification Preferences)

Week 4 — Community + Admin
  ├── Feature 10 (Club Shareable Invite Links)
  ├── Feature 7  (Follow Feed page)
  └── Feature 6  (Coupon system — admin + cart)
```

---

## New Environment Variable Needed

None — all features use existing infra (MongoDB, Cloudinary, existing email SMTP, existing Redis/BullMQ).

---

## Verification Plan

### Per-feature tests to add

| Feature | New backend test | New frontend test |
|---|---|---|
| 1 — Remember Me | `rememberMe: false` issues short-lived token | Checkbox renders + passes flag |
| 6 — Coupons | Coupon validation logic (expired, max uses, min order, inactive) | CartSummary shows discount |
| 8 — Change Password | Wrong current password → 401; correct → tokens revoked | Form validation |
| 10 — Invite Link | Token uniqueness; disabled link returns 404; already-member path | Join flow end-to-end |

### After all features
- Backend Jest: all 42 existing tests pass + new tests (target: ~55 total)
- Frontend Vitest: all 14 existing pass
- Manual browser checklist:
  - [ ] Login with "Remember Me" unchecked → token expires in 1 day
  - [ ] GitHub login button works end-to-end
  - [ ] Profile shows 6 tabs, each renders correctly
  - [ ] Edit name → reload → name persists
  - [ ] Change password → re-login required
  - [ ] Reading Dashboard shows Recharts AreaChart, BarChart, PieChart
  - [ ] Coupon applied at cart → discount shown on total → correct amount charged
  - [ ] Extend rental → prorated fee shown → Razorpay modal opens
  - [ ] Club invite link copied → visiting link shows join page → join works
  - [ ] Disable invite link → old link returns invalid error
  - [ ] Feed page shows reviews + activity from followed users

---

*Plan created: 2026-08-30*
