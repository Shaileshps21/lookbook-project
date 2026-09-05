# 📣 LookBook — Community & Clubs "Mini-Facebook" Plan

> Scope: `A.6 — Community Architecture` in `UPDATED_FUTURE.md`. This document plans the next
> build-out of that section — turning it from "a follow system + bare-bones club threads +
> a leaderboard nobody looks at twice" into a real social layer: people can discover and view
> each other, like and comment on club posts, follow each other, browse a rich public profile
> (reading taste, challenges completed, badges), and actually want to join a challenge instead
> of glancing past it. No new external services or env vars are needed — everything below is
> built on data already flowing through `UserActivity`, `Follow`, `Club`/`Thread`/`Comment`,
> `Shelf`, `Challenge`/`Badge`, and the existing Cloudinary/Notification plumbing.

---

## 0. What already exists (grounded in the current code, not assumed)

| Piece | File(s) | Current shape |
|---|---|---|
| Follow | `models/Follow.ts`, `followController.ts` | Follow/unfollow, counts, followers/following lists, a following-feed (reviews + "finished" activity), "who to follow" suggestions (top reviewers, public profiles only). |
| Clubs | `models/Club.ts`, `clubController.ts`, `ClubDetail.tsx` | Name/description/owner/members, shareable invite link (copy/WhatsApp/QR), member management. **No club feed** — a club is a container for threads only. |
| Threads | `models/Thread.ts`, `threadController.ts` | **Title only — no body.** Scoped to a club *or* a book. This is the biggest gap: what looks like a "post" today is just a clickable title; the actual content lives entirely in the comment list underneath it. |
| Comments | `models/Comment.ts`, `threadController.ts` | Flat comments on a thread, author-or-admin delete. No replies, no reactions. |
| Shelves | `models/Shelf.ts` | Named book lists, `private`/`public` visibility — already what powers "Public Shelves" on `PublicProfile.tsx`. |
| Public profile | `userController.getPublicProfile`, `PublicProfile.tsx` | Opt-in via `User.publicProfile`. Shows name/avatar, follower/following counts, follow button, public shelves, last 20 reviews. **Nothing about reading habits, genres, or challenges** — the richest per-user data in the system (`readingController.getReadingStats`: streak, genre breakdown, monthly books) is never surfaced to anyone but the owner. |
| Challenges | `models/Challenge.ts`, `models/Badge.ts`, `challengeController.ts`, `Challenges.tsx` | Admin-only creation, one dimension ("N books finished in a date window"), progress computed lazily (no explicit join step — every logged-in user is implicitly "in" every challenge), a top-20 leaderboard by name only (no avatars, no podium, no context), badges render as plain text pills. This is the section the user flagged as "too useless" — the diagnosis: nothing to *do* (can't create one, can't join one, can't see a friend's progress from their profile), and nothing that *feels* like an achievement (no celebration, no visibility, badges are inert text). |
| Notifications | `models/Notification.ts` | Typed (`order.*`, `rental.due`, `seller.*`, `price.drop`, `payout.resolved`) + in-app bell. **No community-related types yet** — a like/comment/follow/challenge-completion currently notifies no one. |
| Likes / reactions | — | **Do not exist anywhere in the schema.** Not on reviews, not on threads, not on comments. |
| People directory | — | **Does not exist.** The only way to land on someone's profile today is a link from `ClubDetail`'s member list or the follow-feed's "who to follow" sidebar — there's no page to just browse/search people. |

---

## 1. Data model changes

All additive — no breaking migrations, following this project's established pattern (see
`CHANGES.md`'s `ensureInviteToken()`/`ensureArm` self-healing precedent for fields added after
launch).

### 1.1 `Thread` → becomes a real post
```
content: string (required, maxlength ~3000)   // the missing post body
images?: string[]                              // Cloudinary URLs, reuses the existing
                                                 // /uploads/image endpoint — same pattern
                                                 // as book covers and avatars, no new upload path
likesCount: number (default 0)                  // denormalized, same pattern as commentsCount
```
No rename needed — `Thread` stays the collection/route name (avoids touching every existing
route/test), it just stops being title-only. `createThread` requires `content` going forward;
existing threads with no `content` render with an empty body (harmless, not worth a migration
script for demo data).

### 1.2 New `Like` model (generic, reused for posts and comments)
```ts
{
  user: ObjectId,                    // who liked
  targetType: "thread" | "comment",  // what they liked
  target: ObjectId,                  // the thread or comment id
  createdAt: Date,
}
// unique index: { user, targetType, target } — a user can't double-like the same thing,
// mirrors Badge's { user, challenge } unique index and Follow's { follower, following } one.
```
`Thread.likesCount` / `Comment.likesCount` (new field on `Comment` too) are incremented/
decremented atomically alongside the `Like` write/delete — exactly the `commentsCount`
increment pattern `threadController.addComment` already uses, just extended to likes.

### 1.3 `Challenge` — from "one global list" to "things people actually join"
```
type: "books" | "genre" | "pages" (default "books")   // room to grow past the single
                                                          // dimension without a rewrite
genre?: string                                          // required when type === "genre"
club?: ObjectId (ref Club)                              // optional — a club can run its own
                                                          // challenge, shown on ClubDetail
createdBy: ObjectId (ref User)                          // was implicitly "admin only"; now
                                                          // any user can create a public or
                                                          // club-scoped challenge
participantsCount: number (default 0)                   // denormalized for the directory/card
```

### 1.4 New `ChallengeParticipant` model — the missing "join" step
```ts
{
  user: ObjectId,
  challenge: ObjectId,
  joinedAt: Date,
}
// unique index: { user, challenge }
```
Today progress/leaderboard silently include *everyone*, which is why the leaderboard feels
random and unrelated to "my" challenges. Explicit join makes "My Challenges" a real, personal
list, and the leaderboard only ranks people who opted in — the same shift Goodreads/Strava-style
challenge UIs make, and it's what turns a passive stat into something worth clicking Join on.

### 1.5 `Notification` — new community types
```
"community.like"                // someone liked your post/comment
"community.comment"             // someone commented on your post
"community.follow"              // someone followed you
"community.challengeJoined"     // someone joined a challenge you created
"community.challengeCompleted"  // you completed a challenge (self-notify, for the badge moment)
```
Wired the same way pickup-scheduling notifications were added in the 2026-08-30 session
(`CHANGES.md` Feature 5): fire `notify()` inline at the same choke points the writes already go
through (`Like` create, `addComment`, `followUser`, `ChallengeParticipant` create, the lazy
badge-award branch in `getMyChallengeProgress`) — no new job/queue needed, these are all
request-time, low-volume events.

### 1.6 `User.publicProfile` — no change, but now gates more
The single existing boolean keeps gating everything new below (challenge progress, badges,
genre preferences on the public profile). No new opt-in granularity in phase 1 — matches the
project's existing all-or-nothing privacy model rather than inventing a settings matrix nobody
asked for. (A follow-up "which sections are public" toggle is a reasonable phase-2 idea, noted
in §7.)

---

## 2. Feature plan

### Feature A — Club posts with images, likes, and real comments (the actual "post" experience)
**Backend**
- `createThread` requires `content`; accepts `images[]` (already-uploaded Cloudinary URLs, same
  contract as `EditProfileModal`'s avatar flow — frontend uploads first via
  `POST /uploads/image`, only the URL is sent here).
- New `POST /threads/:threadId/like` / `DELETE /threads/:threadId/like`, same pair on
  `/comments/:commentId/like` — upsert/delete on `Like`, `$inc`/`$dec` the denormalized count,
  fire `community.like` notification to the post/comment author (skip self-notify).
- `getThreadById` response adds `likesCount` + `likedByMe` (a single `Like.exists` check per
  thread/comment, batched — not N+1 — using the same "fetch a bounded window, check membership
  in memory" approach `followController.getFollowingFeed` already uses for feed merging).

**Frontend**
- `ClubDetail.tsx`'s thread list becomes an actual feed card: author avatar/name, post body,
  optional image, a heart/like button with live count, comment count, "View discussion" →
  `ThreadDetail` (existing route, gains a like button per comment too).
- New thread composer (replacing the current single title input) — textarea + optional image
  upload (reuse `EditProfileModal`'s upload widget pattern) + Post button.

**Verification** — same discipline as every prior feature in `CHANGES.md`: `tsc`/eslint clean
both apps, a `threadLikes.test.ts` covering double-like rejection (idempotent unlike), count
consistency after create/delete, and self-notify suppression; then a live Chrome pass (like a
post, unlike it, comment, confirm counts and the notification bell).

### Feature B — People directory ("Find Readers")
**Backend**
- New `GET /users/directory` — public-profile users only, `?q=` name search, `?genre=` filter
  (against `User.preferences.genres`), `?sort=followers|challenges|newest`, paginated. Reuses
  the exact privacy filter `getSuggestedUsers` already applies (`publicProfile: true`,
  excludes the viewer) — this is that same query generalized from "top 5 suggestions" into a
  real browsable/searchable page.
- Response per row: `{ id, name, avatar, followers, mutualFollowers, topGenre, badgesCount }` —
  cheap aggregate fields, no N+1 (one `Follow` countDocuments pass + one `Badge` countDocuments
  pass per page of results, not per row in a loop).

**Frontend**
- New `Community.tsx` page (`/community`) — search bar, genre filter chips, a responsive grid of
  `PersonCard`s (avatar, name, mutual-follow badge, Follow button inline, top genre tag), linking
  to the enriched `PublicProfile`. Added to the navbar/community nav alongside Clubs/Feed/Challenges.

**Verification** — a `usersDirectory.test.ts` (privacy filter holds, search/genre/sort each
work, pagination meta correct); live Chrome check that a private-profile user never appears.

### Feature C — Rich public profile (the actual "view a person" experience)
**Backend** — extend `getPublicProfile` (still gated on `publicProfile: true`, still the one
endpoint, no new route) to add:
- `readingStats` — a public-safe subset of `readingController.getReadingStats`'s existing
  computation: `favouriteGenres`, `streak`, total distinct `finished` count, last-6-month
  `monthlyBooks`. Reuses the same query, doesn't duplicate the logic — factor the shared
  aggregation into a helper both controllers call (`utils/readingStats.ts`) rather than copy
  the Mongo pipeline a second time.
- `badges` — `Badge.find({ user }).populate("challenge", "title")`, same as `getMyBadges` but
  for another user.
- `challengesInProgress` — active challenges the profile owner has joined
  (`ChallengeParticipant`) with current progress, capped at 3 (most-recently-joined first) —
  enough to show "what they're working on" without turning the profile into a second Challenges
  page.
- `clubs` — clubs the profile owner is a member of (name + id only, for a chip list — not
  member lists or invite tokens, which stay private to actual members).
- `mutualFollowers` — when viewed by a logged-in user: up to 3 names of people both the viewer
  and the profile owner follow, `+N more` — the actual "Facebook-style" social-proof line.

**Frontend** — `PublicProfile.tsx` redesign:
- Header gains the streak/genre chips row (reusing the visual language `ProfileHeader.tsx`
  already established for the *owner's* view of their own profile — same stat-tile component,
  just fed someone else's public numbers).
- New "Badges" section — reuse whatever badge-card component Feature E below builds for the
  Challenges page, so a badge looks the same wherever it appears.
- New "Currently Reading Toward" section — the `challengesInProgress` list, each with a mini
  progress ring and a "Join this challenge too" button if the viewer hasn't joined it yet
  (direct funnel from a friend's profile into a challenge — this is the specific mechanic that
  makes challenges feel social instead of solitary).
- New "Clubs" chip row, each linking to `ClubDetail`.
- Mutual-followers line under the name, matching the "Followed by X, Y +N" convention.

**Verification** — extend the existing profile tests for the new fields' privacy gating
(non-public users still 404 on all of it, not just the base fields); live Chrome check on two
real accounts (one with challenge progress + badges, one without, confirming empty states don't
look broken).

### Feature D — Challenges, rebuilt so they're worth opening
This is the section called out directly — the fix is both mechanical (join/leaderboard/creation)
and presentational (it currently looks like a debug page).

**Backend**
- `POST /challenges` — no longer admin-only; any logged-in user can create a **public** or
  **club-scoped** challenge (`clubId` optional, must be a member of that club to scope one to
  it). Admin-created challenges remain (e.g. platform-wide monthly challenges) — `createdBy`
  just records who, `club` records scope; no separate admin-only route needed, the existing
  `adminOnly` route can stay for admin-authored ones or simply be retired in favor of this one
  with a role check dropped — decide based on whether platform-wide "official" challenges should
  stay visually distinct (recommend: yes, an `official: boolean` flag set only via the admin
  route, so the UI can badge admin challenges as "LookBook Official" the way `Book.aiSummary`
  is labeled AI-generated — same "be honest about provenance" convention).
- `POST /challenges/:id/join`, `DELETE /challenges/:id/join` — creates/deletes
  `ChallengeParticipant`; joining fires nothing (quiet), completing fires
  `community.challengeCompleted` to self + `community.challengeJoined` to the challenge creator
  (skip self-notify when creator === joiner).
- `getMyChallengeProgress` — now checks `ChallengeParticipant` first (404/soft-block progress
  computation for non-participants, or auto-join on first progress check — recommend auto-join,
  since "check progress" is an unambiguous intent signal and an extra confirmation click adds
  friction with no benefit).
- `getLeaderboard` — restrict to joined participants only (`$match` against
  `ChallengeParticipant` user ids before the existing aggregation), add `rank` and the viewer's
  own row even if outside top-20 (`"you're #34"` beats silently not appearing).
- `GET /challenges/mine` — joined challenges (active + completed, separated), backs the "My
  Challenges" tab.

**Frontend** — `Challenges.tsx` full redesign:
- Tabs: **Discover** (all public + your clubs' challenges, Join button inline) / **My
  Challenges** (joined, active progress rings) / **Completed** (badge showcase) / **+ Create**
  (title, description, target, type, date range, optional "scope to a club" dropdown of clubs
  you belong to).
- Each challenge card: progress as a **ring**, not a thin bar (more legible at a glance, and
  visually distinct from the reading-dashboard's existing bar-based stats so the two don't look
  identical); a **podium** (top 3 with avatars, gold/silver/bronze accent) above the rest of the
  leaderboard list instead of a flat top-5 text list; "LookBook Official" badge chip for
  `official: true` challenges; a club-name chip for club-scoped ones, linking back to
  `ClubDetail`.
- Completion moment: when `getMyChallengeProgress` flips `completed: true` for the first time in
  a session, a small celebratory toast/confetti-once animation (CSS only, no new dependency) —
  the "nothing feels like an achievement" gap called out in §0.
- Badges get a real card (icon + title + challenge name + awarded date) instead of a text pill,
  reused verbatim on `PublicProfile.tsx` (Feature C) so a badge looks the same everywhere it's
  shown — one component, two places.
- `ClubDetail.tsx` gains a small "Club Challenges" strip (reusing the same challenge card,
  filtered to `club: id`) so a club feels like it can run its own reading sprint, not just host
  threads.

**Verification** — `challengeParticipants.test.ts` (join/leave, leaderboard excludes
non-joiners, viewer's own rank surfaces outside top-20, club-scoped creation requires
membership, non-member can't scope a challenge to a club they're not in, official flag only
settable via the admin path); live Chrome pass through create → join → mark a book finished →
watch progress update → complete → confirm the badge appears on both Challenges and the public
profile.

### Feature E — Notifications tie-in
Already specified per-event in §1.5 and folded into Features A/D above rather than being its
own backend surface — called out separately here only so it isn't build-order-forgotten. Bell
icon and `NotificationsSection` (email-preference toggles, per `CHANGES.md`'s Feature 9) need no
changes; the existing components already render whatever `Notification` documents exist.

### Feature F — Stretch: a unified Community feed
Once A–E exist, `Feed.tsx` (currently: followed users' reviews + "finished" activity only) can
merge in a third stream — recent public posts (`Thread` with `club` set) from clubs the viewer
is in, plus challenge-completion events from people they follow — using the exact same
bounded-window-merge pattern `getFollowingFeed` already implements for two streams, extended to
three. Explicitly a **stretch**, not required for the "mini Facebook" feel — Features A–D already
deliver browsing, liking, commenting, following, rich profiles, and real challenges; this just
makes the existing Feed page the one-stop scroll instead of visiting Clubs/Challenges
separately.

---

## 3. API surface summary (new/changed only)

```
POST   /threads                          — now requires content, accepts images[]
POST   /threads/:threadId/like           — like a post
DELETE /threads/:threadId/like           — unlike a post
POST   /comments/:commentId/like         — like a comment
DELETE /comments/:commentId/like         — unlike a comment

GET    /users/directory                  — search/browse public profiles
GET    /users/:userId/public-profile     — (existing route, response body extended)

POST   /challenges                       — no longer admin-only; club-scoped optional
POST   /challenges/:id/join
DELETE /challenges/:id/join
GET    /challenges/mine                  — joined, split active/completed
GET    /challenges/:id/leaderboard       — now joined-only + viewer's own rank
GET    /challenges/:challengeId/progress — now auto-joins on first call
```

---

## 4. Suggested build order

1. **Feature A (likes + real post content)** — smallest surface area, immediately makes club
   pages feel alive, no dependency on anything else here.
2. **Feature C (rich public profile)** — mostly read-aggregation of data that already exists
   (`readingController`'s stats, `Badge`, `Shelf`), high visible payoff for modest backend work.
3. **Feature B (people directory)** — small once Feature C's profile is worth linking to; low
   value shipping a directory that still points at the bare-bones profile.
4. **Feature D (challenges rebuild)** — the largest single piece (new join model, leaderboard
   rework, full page redesign) — sequenced last among the core four so it can reuse the badge
   card and progress-ring components once, and so `PublicProfile` (Feature C) already has a slot
   ready for `challengesInProgress` the moment joining exists.
5. **Feature E** threads through 1–4 as each lands, not a separate pass.
6. **Feature F (unified feed)** — stretch, only after A–D are live and used for a bit.

Each feature should land, get `tsc`/eslint/Jest/Vitest-clean, and get a live Chrome pass before
starting the next — the same discipline `CHANGES.md`'s 2026-08-30 feature-by-feature session
already established, rather than batching all five into one big-bang change.

---

## 5. Open questions (need a decision before or during Feature D specifically)

- **Should admin-created "official" challenges keep a separate creation path**, or should
  `official` just be a flag any admin can set on a normal create call? (Recommend: flag on the
  same endpoint, gated by `role === "admin"` in the request handler — one endpoint, not two.)
- **Auto-join on first progress check, or require an explicit Join click?** (Recommended above:
  auto-join — checking progress is unambiguous intent, and Goodreads' own "Reading Challenge"
  UX auto-enrolls the moment you set a goal.)
- **Does liking a comment need its own notification**, or is that too noisy at comment-thread
  scale? (Lean toward: yes for the comment's author, same suppression-of-self as everywhere
  else — but flag this one for the user to weigh in on if in-app notification volume becomes a
  complaint later.)
