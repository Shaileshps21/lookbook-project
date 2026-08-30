<<<<<<< HEAD
# LookBook

A full-stack platform to **rent, buy, and sell books** — a React + TypeScript
frontend backed by a Node.js/Express + MongoDB REST API, fully wired together
(real auth, real data, real cart/wishlist/checkout, no mock data left in the
app).

```
lookbook-project/
├── lookbook-frontend/    # React + Vite + Tailwind + Framer Motion
├── lookbook-backend/     # Express + TypeScript + MongoDB (Mongoose) + JWT
└── CHANGES.md            # Log of the frontend↔backend wiring work
```

---

## What's included

**Frontend** (`lookbook-frontend/`)
- Home, browse/search/filter/sort, book detail + reviews, rent, sell, membership
  plans, cart, wishlist, login/register, profile with order history.
- Real API calls everywhere — no more hardcoded arrays. Guests get a
  localStorage-backed cart/wishlist; logging in syncs it to the server.
- Built with React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router.

**Backend** (`lookbook-backend/`)
- REST API: auth (JWT), books (search/filter/sort/pagination), categories,
  membership plans, reviews, cart, wishlist, checkout/orders, sell listings.
- Built with Express, TypeScript, Mongoose (MongoDB), Zod validation, bcrypt,
  Helmet, CORS, rate limiting on auth routes.
- Ships with a seed script (demo books/categories/plans + a demo admin account),
  a Dockerfile + docker-compose (API + MongoDB), and a `requests.http` file for
  manual testing.

---

## How everything fits together

```
┌─────────────────────┐        HTTP/JSON        ┌──────────────────────┐
│  lookbook-frontend    │  ───────────────────▶  │   lookbook-backend    │
│  (Vite dev server,     │  ◀───────────────────  │   (Express API,        │
│   http://localhost:5173) │      JWT in header     │    http://localhost:5000) │
└─────────────────────┘                         └──────────┬───────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │     MongoDB        │
                                                     │  (local, Atlas,     │
                                                     │   or Docker)         │
                                                     └──────────────────┘
```

- The frontend reads `VITE_API_URL` (default `http://localhost:5000/api`) and
  talks to the backend over `fetch`.
- Auth is JWT-based: on login/register the backend returns a token, which the
  frontend stores in `localStorage` and sends as `Authorization: Bearer <token>`
  on every subsequent request.
- Cart and wishlist work for guests too (localStorage only). The moment
  someone logs in, their local cart/wishlist is merged into their account and
  all further changes sync to the server in the background.

---

## Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** — pick one:
  - A free **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)**
    cluster (no local install — recommended if you don't already have Mongo)
  - A local MongoDB install (`mongod` running on `27017`)
  - **Docker** (the backend ships a `docker-compose.yml` that runs Mongo for you)

---

## Running it — step by step

### 1. Start MongoDB

Pick whichever you set up above. If you're using Atlas, just grab your
connection string — nothing to "start" locally.

### 2. Start the backend

```bash
cd lookbook-backend
npm install
cp .env.example .env
```

Edit `.env`:
```
MONGO_URI=mongodb://127.0.0.1:27017/lookbook   # or your Atlas connection string
JWT_SECRET=some_long_random_string_here
CLIENT_URL=http://localhost:5173                 # must match the frontend's dev URL
```

Seed demo data and start the API:
```bash
npm run seed     # inserts demo books/categories/plans + an admin account
npm run dev      # starts on http://localhost:5000
```

Confirm it's running: open **http://localhost:5000/health** — you should see
`{"success":true,"message":"OK",...}`.

Demo admin account created by the seed script:
```
email:    admin@lookbook.dev
password: Admin@12345
```

**Prefer Docker?**
```bash
cd lookbook-backend
docker compose up --build
```
This runs MongoDB + the API together on their default ports. Run
`npm run seed` once afterwards (with `MONGO_URI=mongodb://localhost:27017/lookbook`
in your local `.env`) to populate demo data.

### 3. Start the frontend

```bash
cd lookbook-frontend
npm install
npm run dev
```

Open **http://localhost:5173**. A `.env` is already included pointing at
`http://localhost:5000/api` — change `VITE_API_URL` there if your backend runs
somewhere else.

### 4. Try it out

- Browse books on the home page, in **Categories**, or **Rent**.
- **Register** an account (or log in as the seeded admin), then:
  - Add books to your cart and wishlist — watch them persist across refreshes.
  - Open a book and leave a review.
  - Go to **Cart → Proceed to Checkout** to place an order.
  - Visit **Profile** to see your order history.
  - Try **Sell** to submit a book listing (requires login).

---

## Project scripts reference

### `lookbook-backend`
| Script                | What it does                                      |
|------------------------|-----------------------------------------------------|
| `npm run dev`           | Start the API with hot reload                       |
| `npm run build`         | Compile TypeScript → `dist/`                          |
| `npm start`             | Run the compiled API (`dist/server.js`)              |
| `npm run seed`          | Wipe & re-seed books/categories/plans + demo admin    |
| `npm run seed:destroy`  | Remove books/categories/plans only                    |
| `npm run lint`          | ESLint over `src/`                                    |

### `lookbook-frontend`
| Script            | What it does                        |
|--------------------|----------------------------------------|
| `npm run dev`       | Start the Vite dev server              |
| `npm run build`     | Type-check + production build          |
| `npm run preview`   | Preview the production build locally   |
| `npm run lint`      | ESLint over `src/`                      |

---

## API reference

See **`lookbook-backend/README.md`** for the full endpoint list (auth, books,
reviews, categories, plans, cart, wishlist, orders, listings), request/response
shapes, and environment variables. See **`lookbook-backend/requests.http`**
for ready-to-run example requests (works with the VS Code "REST Client"
extension, or copy into curl/Postman).

---

## Troubleshooting

- **Frontend shows "Couldn't load books" / spinners that never resolve** — the
  backend isn't running or isn't reachable at `VITE_API_URL`. Check
  `http://localhost:5000/health` first.
- **CORS errors in the browser console** — make sure `CLIENT_URL` in the
  backend's `.env` exactly matches the URL the frontend is served from
  (including port).
- **401 errors right after logging in** — check `JWT_SECRET` is set in the
  backend `.env`; if it's missing, it falls back to a dev default, which is
  fine locally but will invalidate old tokens if you change it later.
- **`npm run seed` fails to connect** — double-check `MONGO_URI`; for Atlas,
  make sure your current IP is allow-listed under Network Access.

---

## What's *not* included (intentionally out of scope)

- Payment processing (checkout creates an `Order` record but doesn't charge
  anything — no Stripe/Razorpay integration).
- Image uploads (the "Sell" form's photo dropzone is a visual placeholder;
  book/cover images are served from static URLs).
- Email sending (no password-reset or order-confirmation emails).
- An admin dashboard UI (the backend has admin-only endpoints — create/update/
  delete books, moderate sell listings — but there's no frontend screen for
  them yet; use `requests.http` or the demo admin account with a tool like
  Postman).

These are natural next steps if you want to keep building on this.