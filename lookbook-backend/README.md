# LookBook API

A REST API for **LookBook** — a platform to rent, buy, and sell books. Built with
Node.js, Express, TypeScript, and MongoDB (Mongoose). Designed to pair directly with
the LookBook React frontend (matching types: `Book`, `Review`, `Category`, `Plan`,
`CartItem`, `User`).

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 4
- **Database:** MongoDB via Mongoose 8
- **Auth:** JWT (Bearer token or httpOnly cookie) + bcrypt password hashing
- **Validation:** Zod
- **Security:** Helmet, CORS, express-rate-limit on auth routes

## Project Structure

```
lookbook-backend/
├── src/
│   ├── config/          # env loader, MongoDB connection
│   ├── models/           # Mongoose schemas (User, Book, Review, Category, Plan, Order, Listing)
│   ├── controllers/      # route handlers / business logic
│   ├── routes/           # Express routers per resource
│   ├── middleware/       # auth guard, error handler, zod validator
│   ├── validators/       # Zod schemas per resource
│   ├── utils/            # ApiError, ApiResponse, asyncHandler, token helpers, query features
│   ├── data/              # seed data (mirrors frontend mock data)
│   ├── types/express/    # Request.user type augmentation
│   ├── seed.ts           # database seed script
│   ├── app.ts            # Express app (middleware + routes)
│   └── server.ts         # entry point (connects DB, starts server)
├── .env.example
├── package.json
└── tsconfig.json
```

## Getting Started

```bash
cd lookbook-backend
npm install
cp .env.example .env      # then edit MONGO_URI / JWT_SECRET as needed
npm run seed               # populates books, categories, plans + a demo admin
npm run dev                 # starts the API with hot reload on http://localhost:5000
```

Demo admin created by the seed script:
```
email:    admin@lookbook.dev
password: Admin@12345
```

### Available Scripts

| Script              | Description                                      |
|---------------------|---------------------------------------------------|
| `npm run dev`        | Start in watch mode with `ts-node` + `nodemon`     |
| `npm run build`      | Compile TypeScript to `dist/`                      |
| `npm start`          | Run the compiled JS (`dist/server.js`)             |
| `npm run seed`       | Wipe & re-seed books/categories/plans + demo admin |
| `npm run seed:destroy` | Wipe books/categories/plans only                 |
| `npm run lint`       | Run ESLint over `src/`                             |

## Environment Variables

See `.env.example`. Key ones:

| Variable      | Description                                   |
|---------------|-------------------------------------------------|
| `MONGO_URI`   | MongoDB connection string                       |
| `JWT_SECRET`  | Secret used to sign JWTs — set a long random value in production |
| `CLIENT_URL`  | Frontend origin, used for CORS                  |
| `PORT`        | Port the API listens on (default `5000`)        |

## Authentication

The API issues a JWT on register/login. It is returned both in the JSON response
(`data.token`) and as an httpOnly cookie (`lookbook_token`), so the frontend can use
whichever fits its setup:

- **Bearer token:** send `Authorization: Bearer <token>` on protected requests.
- **Cookie:** if the frontend runs on the same site (or CORS `credentials: true` is
  configured, as it is here), the cookie is sent automatically — no extra header needed.

## API Reference

Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint         | Auth | Description                  |
|--------|------------------|------|-------------------------------|
| POST   | `/auth/register`  | —    | Create an account             |
| POST   | `/auth/login`     | —    | Log in                        |
| POST   | `/auth/logout`    | —    | Clear auth cookie             |
| GET    | `/auth/me`        | ✅   | Get the current user          |

### Books
| Method | Endpoint                  | Auth        | Description                                    |
|--------|----------------------------|-------------|--------------------------------------------------|
| GET    | `/books`                   | —           | List books — supports `search`, `category`, `minPrice`, `maxPrice`, `sort` (`popular`\|`price-asc`\|`price-desc`\|`rating`\|`newest`), `page`, `limit` |
| GET    | `/books/:id`                | —           | Get a single book                              |
| GET    | `/books/:id/similar`        | —           | Books in the same category                     |
| POST   | `/books`                    | ✅ admin    | Create a book                                  |
| PUT    | `/books/:id`                | ✅ admin    | Update a book                                   |
| DELETE | `/books/:id`                | ✅ admin    | Delete a book                                   |

### Reviews
| Method | Endpoint                        | Auth | Description                  |
|--------|-----------------------------------|------|--------------------------------|
| GET    | `/books/:id/reviews`               | —    | List reviews for a book       |
| POST   | `/books/:id/reviews`               | ✅   | Add a review (one per user)   |
| DELETE | `/books/:id/reviews/:reviewId`     | ✅   | Delete your own review (or any, as admin) |

### Categories & Plans
| Method | Endpoint       | Auth | Description         |
|--------|-----------------|------|----------------------|
| GET    | `/categories`    | —    | List categories      |
| GET    | `/plans`         | —    | List membership plans|

### Cart *(per logged-in user)*
| Method | Endpoint                  | Description                          |
|--------|----------------------------|----------------------------------------|
| GET    | `/cart`                    | Get cart with populated book details + subtotal |
| POST   | `/cart`                    | Add `{ bookId, mode: "rent"\|"buy" }`  |
| PATCH  | `/cart/:bookId/:mode`      | Update `{ quantity }` (0 removes it)   |
| DELETE | `/cart/:bookId/:mode`      | Remove one line item                    |
| DELETE | `/cart`                    | Clear the cart                          |

### Wishlist *(per logged-in user)*
| Method | Endpoint             | Description                |
|--------|-----------------------|------------------------------|
| GET    | `/wishlist`            | List wishlisted books        |
| POST   | `/wishlist/:bookId`    | Toggle a book on/off the list|
| DELETE | `/wishlist/:bookId`    | Remove a book explicitly     |

### Orders (checkout / rental history)
| Method | Endpoint            | Description                                     |
|--------|-----------------------|---------------------------------------------------|
| POST   | `/orders/checkout`    | Convert the current cart into an order, decrements stock, clears cart |
| GET    | `/orders`              | List the current user's orders                    |
| GET    | `/orders/:id`          | Get a single order (owner or admin only)           |

### Listings (Sell a book)
| Method | Endpoint                | Auth        | Description                          |
|--------|---------------------------|-------------|----------------------------------------|
| POST   | `/listings`               | ✅          | Submit a book for sale (status: Pending) |
| GET    | `/listings/mine`          | ✅          | Your submitted listings                |
| GET    | `/listings`                | ✅ admin    | All listings, optional `?status=` filter|
| PATCH  | `/listings/:id/status`     | ✅ admin    | Approve/Reject a listing                |
| DELETE | `/listings/:id`            | ✅          | Delete your own listing (or any, as admin) |

## Response Shape

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "message": "Books fetched successfully",
  "data": [ /* ... */ ],
  "meta": { "page": 1, "limit": 12, "total": 42, "totalPages": 4 }
}
```

Errors follow the same envelope with `"success": false` and a `message`, plus an
optional `errors` array for validation failures:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "path": "email", "message": "Please provide a valid email address" }]
}
```

## Connecting the Frontend

Point the frontend's `services/*.ts` files at `http://localhost:5000/api` (e.g. via a
`VITE_API_URL` env var) and swap the in-memory mock calls for `fetch`/`axios` calls to
these endpoints — the shapes of `Book`, `Review`, `Category`, `Plan`, and cart/wishlist
items were kept identical to the frontend's `src/types/index.ts` so no type changes
should be needed on that side.
