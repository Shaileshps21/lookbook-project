# 🚀 LookBook — Complete Deployment Guide (No Docker)

> **Prerequisites you already have:**
> - ✅ MongoDB Atlas cluster + connection string
> - ✅ Redis / Upstash instance + connection URL
> - ✅ Cloudinary account + Cloud Name, API Key, API Secret

---

## Table of Contents

1. [Step 0 — Push Code to GitHub](#step-0--push-code-to-github)
2. [Step 1 — Deploy Backend on Render](#step-1--deploy-backend-on-render)
3. [Step 2 — Deploy Frontend on Vercel](#step-2--deploy-frontend-on-vercel)
4. [Step 3 — Connect Frontend ↔ Backend](#step-3--connect-frontend--backend)
5. [Step 4 — Update CORS & Allowed Origins](#step-4--update-cors--allowed-origins)
6. [Step 5 — Verify Everything Works](#step-5--verify-everything-works)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Troubleshooting](#troubleshooting)

---

## Step 0 — Push Code to GitHub

Both Render and Vercel deploy **directly from a GitHub repository**. If your code is not on GitHub yet, do this first.

### 0.1 — Initialize Git (if not already done)

Open a terminal in your project root (`lookbook-project/`) and run:

```bash
git init
git add .
git commit -m "initial commit"
```

### 0.2 — Create a GitHub Repository

1. Go to https://github.com → click **"New"** (top-left green button)
2. Repository name: `lookbook-project`
3. Set to **Private** (recommended — it has your `.env.example` with key names)
4. Click **Create repository**

### 0.3 — Push Your Code

Copy the commands GitHub shows you under "…or push an existing repository":

```bash
git remote add origin https://github.com/YOUR_USERNAME/lookbook-project.git
git remote add origin https://github.com/Shaileshps21/lookbook-project
git branch -M main
git push -u origin main
```

> ⚠️ **Important:** Make sure your `.gitignore` files include `.env` so real secrets are never pushed.
> The `lookbook-backend/.gitignore` and `lookbook-frontend/.gitignore` already handle this.

---

## Step 1 — Deploy Backend on Render

Render will run your Node.js/Express backend.
Free tier sleeps after 15 min of inactivity — use Starter ($7/mo) for always-on.

### 1.1 — Create a Render Account

Go to https://render.com → Sign up (use your GitHub account for easy integration).

### 1.2 — Create a New Web Service

1. From your Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect a repository"** → authorize GitHub → select `lookbook-project`
3. Fill in the service details:

| Field            | Value                          |
|------------------|--------------------------------|
| **Name**         | `lookbook-backend`             |
| **Region**       | Singapore (closest to India)   |
| **Branch**       | `main`                         |
| **Root Directory** | `lookbook-backend`           |
| **Runtime**      | `Node`                         |
| **Build Command**| `npm install --include=dev && npm run build` |
| **Start Command**| `node dist/server.js`          |
| **Instance Type**| `Free`                         |

4. Click **"Advanced"** to expand environment variable settings.

### 1.3 — Add Environment Variables on Render

In the **"Environment"** section, add each of the following as key-value pairs:

#### 🔴 Required — Must Fill In

```
NODE_ENV                    = production
PORT                        = 5000

MONGO_URI                   = mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=lookbook

REDIS_URL                   = rediss://default:<password>@<host>:<port>

CLOUDINARY_CLOUD_NAME       = your_cloud_name
CLOUDINARY_API_KEY          = your_api_key
CLOUDINARY_API_SECRET       = your_api_secret

# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET                  = <generated-hex>
JWT_REFRESH_SECRET          = <different-generated-hex>
SESSION_SECRET              = <another-generated-hex>
JWT_EXPIRES_IN              = 7d
COOKIE_NAME                 = lookbook_token

# Fill these AFTER Step 2 (you'll have the Vercel URL then)
CLIENT_URL                  = https://your-vercel-app.vercel.app
FRONTEND_URL                = https://your-vercel-app.vercel.app
BACKEND_URL                 = https://lookbook-backend.onrender.com
```

#### 🟡 Optional — Fill If You Use These Features

```
# Google OAuth
GOOGLE_CLIENT_ID            = <your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET        = <your-google-client-secret>
# Without this, the backend defaults to http://localhost:5000/api/auth/google/callback
# even in production — Google will send users back to localhost. Must exactly match
# an Authorized redirect URI on the Google Cloud OAuth client.
GOOGLE_REDIRECT_URI         = https://lookbook-backend.onrender.com/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID            = <your-github-client-id>
GITHUB_CLIENT_SECRET        = <your-github-client-secret>
# Same localhost-fallback trap as GOOGLE_REDIRECT_URI above.
GITHUB_REDIRECT_URI         = https://lookbook-backend.onrender.com/api/auth/github/callback

# Razorpay Payments
RAZORPAY_KEY_ID             = rzp_live_<key>
RAZORPAY_KEY_SECRET         = <secret>
RAZORPAY_WEBHOOK_SECRET     = <webhook-secret>

# AI Features (Gemini / GROQ)
GEMINI_API_KEY              = <your-gemini-key>
GEMINI_TEXT_MODEL           = gemini-2.5-flash
GEMINI_EMBEDDING_MODEL      = gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS = 768
GROQ_API_KEY                = gsk_<your-groq-key>
GROQ_TEXT_MODEL             = llama-3.3-70b-versatile
GROQ_VISION_MODEL           = llama-3.2-90b-vision-preview

# Email (SMTP — Brevo or similar)
SMTP_HOST                   = smtp-relay.brevo.com
SMTP_PORT                   = 587
SMTP_USER                   = <your-smtp-user>
SMTP_PASS                   = <your-smtp-password>

# Web Push Notifications
# Generate with: cd lookbook-backend && npm run push:keys
VAPID_PUBLIC_KEY            = <your-vapid-public-key>
VAPID_PRIVATE_KEY           = <your-vapid-private-key>

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS   = 900000
AUTH_RATE_LIMIT_MAX         = 20
```

### 1.4 — Deploy the Backend

1. Click **"Create Web Service"**
2. Watch the build logs — takes ~2-3 minutes
3. Once it says **"Live"** with a green dot, your backend is up ✅

### 1.5 — Note Your Backend URL

Render gives you a URL like:
```
https://lookbook-backend.onrender.com
```
**Copy this — you need it in Step 2.**

### 1.6 — Test Your Backend

Open in browser:
```
https://lookbook-backend.onrender.com/health
```

Expected response:
```json
{ "success": true, "message": "OK", "timestamp": "..." }
```

---

## Step 2 — Deploy Frontend on Vercel

Vercel is the best platform for React/Vite apps. It auto-detects your setup.

### 2.1 — Create a Vercel Account

Go to https://vercel.com → Sign up with GitHub.

### 2.2 — Import Your Repository

1. From the Vercel dashboard, click **"Add New…"** → **"Project"**
2. Find and select your `lookbook-project` repository
3. Set the **Root Directory** to `lookbook-frontend`

### 2.3 — Verify Build Settings

Vercel auto-detects Vite, but confirm these settings:

| Field               | Value               |
|---------------------|---------------------|
| **Framework Preset**| `Vite`              |
| **Root Directory**  | `lookbook-frontend` |
| **Build Command**   | `npm run build`     |
| **Output Directory**| `dist`              |
| **Install Command** | `npm install`       |

### 2.4 — Add Environment Variable

In the **"Environment Variables"** section, add:

| Key            | Value                                            |
|----------------|--------------------------------------------------|
| `VITE_API_URL` | `https://lookbook-backend.onrender.com/api`      |

> ⚠️ **Critical:** The variable MUST start with `VITE_` — Vite only exposes variables
> with this prefix to the browser. Without it, your frontend cannot reach the backend.

### 2.5 — Deploy

1. Click **"Deploy"**
2. Build takes ~1-2 minutes
3. You get a URL like: `https://lookbook-v2.vercel.app` ✅

**Copy this URL — you need it in Step 3.**

### 2.6 — Add SPA Routing Fallback (Important!)

Your React app uses React Router. Without this step, refreshing any page other than `/` will 404.

Create the file `lookbook-frontend/vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Then commit and push:

```bash
git add lookbook-frontend/vercel.json
git commit -m "chore: add Vercel SPA routing fallback"
git push
```

Vercel auto-redeploys on every push. ✅

---

## Step 3 — Connect Frontend ↔ Backend

### 3.1 — Update Backend CORS on Render

Go back to Render → your service → **"Environment"** → update:

| Key            | New Value                              |
|----------------|----------------------------------------|
| `CLIENT_URL`   | `https://your-actual-app.vercel.app`   |
| `FRONTEND_URL` | `https://your-actual-app.vercel.app`   |

Click **"Save Changes"** — Render auto-redeploys.

### 3.2 — Confirm VITE_API_URL on Vercel

Vercel → your project → **"Settings"** → **"Environment Variables"**:

| Key            | Value                                       |
|----------------|---------------------------------------------|
| `VITE_API_URL` | `https://lookbook-backend.onrender.com/api` |

If you change it, go to **Deployments** → latest → **Redeploy**.

---

## Step 4 — Update CORS & Allowed Origins

Your backend reads CORS origin from `CLIENT_URL` in `app.ts`:

```typescript
cors({
  origin: env.clientUrl,  // ← CLIENT_URL env var
  credentials: true,
})
```

Make sure `CLIENT_URL` on Render **exactly** matches your Vercel URL:

- ✅ Correct: `https://lookbook-v2.vercel.app`
- ❌ Wrong:   `https://lookbook-v2.vercel.app/`  ← no trailing slash!

### 4.1 — OAuth Redirect URIs (If You Use Google/GitHub Login)

**Google OAuth:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. **Authorized redirect URIs** → add:
   `https://lookbook-backend.onrender.com/api/auth/google/callback`
4. **Authorized JavaScript origins** → add:
   `https://your-app.vercel.app`

**GitHub OAuth:**
1. Go to https://github.com/settings/developers → OAuth Apps
2. Edit your app:
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://lookbook-backend.onrender.com/api/auth/github/callback`

---

## Step 5 — Verify Everything Works

Run through this checklist after deployment:

### ✅ Backend Health Check
```
https://lookbook-backend.onrender.com/health
→ Expected: { "success": true, "message": "OK" }
```

### ✅ Frontend Loads
```
https://your-app.vercel.app
→ Expected: LookBook app loads, no blank screen, no console errors
```

### ✅ API Calls Work
- Open browser DevTools (F12) → Network tab
- Try logging in or loading the books list
- Requests should go to `lookbook-backend.onrender.com` with status `200`
- No `CORS error` or `Network Error`

### ✅ MongoDB Connected
Render logs should show:
```
[server] LookBook API running on port 5000 (production)
```
No `MongoNetworkError` or `Authentication failed`.

### ✅ Redis Connected (BullMQ Queues)
Render logs should show:
```
[queues] Rental reminder, leaderboard, analytics and smart-pricing workers started.
```

### ✅ Cloudinary Works
Try uploading a book cover image — should upload and display successfully.

### ✅ React Router Works
Navigate to any inner page, refresh the browser → should NOT 404.

---

## Environment Variables Reference

### Backend (set on Render)

| Variable                    | Required | Description                          |
|-----------------------------|----------|--------------------------------------|
| `NODE_ENV`                  | ✅       | `production`                         |
| `PORT`                      | ✅       | `5000`                               |
| `MONGO_URI`                 | ✅       | MongoDB Atlas connection string       |
| `REDIS_URL`                 | ✅       | Redis/Upstash URL (for queues)        |
| `JWT_SECRET`                | ✅       | Random hex string (≥48 chars)         |
| `JWT_REFRESH_SECRET`        | ✅       | Different random hex string           |
| `JWT_EXPIRES_IN`            | ✅       | `7d`                                  |
| `SESSION_SECRET`            | ✅       | Random hex string                     |
| `COOKIE_NAME`               | ✅       | `lookbook_token`                      |
| `CLIENT_URL`                | ✅       | Your Vercel frontend URL              |
| `FRONTEND_URL`              | ✅       | Same as CLIENT_URL                    |
| `BACKEND_URL`               | ✅       | Your Render backend URL               |
| `CLOUDINARY_CLOUD_NAME`     | ✅       | From Cloudinary dashboard             |
| `CLOUDINARY_API_KEY`        | ✅       | From Cloudinary dashboard             |
| `CLOUDINARY_API_SECRET`     | ✅       | From Cloudinary dashboard             |
| `GOOGLE_CLIENT_ID`          | Optional | Google OAuth                          |
| `GOOGLE_CLIENT_SECRET`      | Optional | Google OAuth                          |
| `GOOGLE_REDIRECT_URI`       | Required if using Google OAuth | `https://<backend>.onrender.com/api/auth/google/callback` — omitting this silently falls back to `localhost`, breaking login in production |
| `GITHUB_CLIENT_ID`          | Optional | GitHub OAuth                          |
| `GITHUB_REDIRECT_URI`       | Required if using GitHub OAuth | Same localhost-fallback trap as `GOOGLE_REDIRECT_URI` |
| `GITHUB_CLIENT_SECRET`      | Optional | GitHub OAuth                          |
| `RAZORPAY_KEY_ID`           | Optional | Razorpay payments                     |
| `RAZORPAY_KEY_SECRET`       | Optional | Razorpay payments                     |
| `RAZORPAY_WEBHOOK_SECRET`   | Optional | Razorpay webhooks                     |
| `GEMINI_API_KEY`            | Optional | AI recommendations                    |
| `GEMINI_TEXT_MODEL`         | Optional | `gemini-2.5-flash`                    |
| `GEMINI_EMBEDDING_MODEL`    | Optional | `gemini-embedding-001`                |
| `GEMINI_EMBEDDING_DIMENSIONS` | Optional | `768`                               |
| `GROQ_API_KEY`              | Optional | AI fallback                           |
| `GROQ_TEXT_MODEL`           | Optional | `llama-3.3-70b-versatile`             |
| `GROQ_VISION_MODEL`         | Optional | `llama-3.2-90b-vision-preview`        |
| `SMTP_HOST`                 | Optional | Email (e.g., smtp-relay.brevo.com)    |
| `SMTP_PORT`                 | Optional | `587`                                 |
| `SMTP_USER`                 | Optional | SMTP username                         |
| `SMTP_PASS`                 | Optional | SMTP password                         |
| `VAPID_PUBLIC_KEY`          | Optional | Web Push notifications                |
| `VAPID_PRIVATE_KEY`         | Optional | Web Push notifications                |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Optional | `900000` (15 min)                     |
| `AUTH_RATE_LIMIT_MAX`       | Optional | `20`                                  |

### Frontend (set on Vercel)

| Variable       | Required | Description                                    |
|----------------|----------|------------------------------------------------|
| `VITE_API_URL` | ✅       | `https://lookbook-backend.onrender.com/api`    |

---

## Generating Secrets Locally

Run these in your terminal to generate cryptographically strong secrets:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# JWT_REFRESH_SECRET (run again — different value)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID keys (run from lookbook-backend/)
cd lookbook-backend
npm run push:keys
```

---

## Troubleshooting

### ❌ CORS Error in Browser Console
- Check `CLIENT_URL` on Render matches Vercel URL exactly — no trailing slash
- Redeploy backend after changing env vars

### ❌ "Continue with Google" redirects to http://localhost:5000/...
- `GOOGLE_REDIRECT_URI` isn't set on Render — `lookbook-backend/src/config/env.ts`
  falls back to `http://localhost:${PORT}/api/auth/google/callback` whenever it's
  missing, and that fallback applies in production too, not just dev.
- Fix: add `GOOGLE_REDIRECT_URI` (and `GITHUB_REDIRECT_URI` if using GitHub login)
  on Render set to `https://<your-backend>.onrender.com/api/auth/google/callback`,
  and make sure that exact URL is also added under Authorized redirect URIs on the
  Google Cloud OAuth client — the two must match exactly (scheme, host, and path).

### ❌ Frontend Shows Blank Page / White Screen
- Check browser DevTools console for errors
- Verify `VITE_API_URL` is correctly set on Vercel
- Make sure `vercel.json` with SPA rewrites is committed and pushed

### ❌ Backend Build Fails on Render
- Check Render build logs — usually a TypeScript error
- Run `npm run build` locally first to catch errors before pushing
- **If the log shows dozens of `Cannot find name 'console'/'fetch'/'Buffer'` or
  `Could not find a declaration file for module 'express'` errors**: this is
  `NODE_ENV=production` (required, see above) causing `npm install` to skip
  `devDependencies` on a *fresh* install — and `typescript`/`@types/*` are all
  devDependencies here. It won't reproduce locally (your shell isn't running
  `NODE_ENV=production`) and can even look intermittent on Render itself,
  since a cache-hit install ("up to date, audited N packages") reuses
  whatever was installed last time while a cache-miss install re-applies the
  skip. Fixed by making the Build Command `npm install --include=dev && npm
  run build` (already reflected in Step 1.2 above) so devDependencies always
  install regardless of `NODE_ENV`.

### ❌ MongoNetworkError — DB Connection Fails
- **This is the most common issue on Render free tier**
- MongoDB Atlas blocks unknown IPs by default
- Fix: Atlas → Network Access → Add IP Address → `0.0.0.0/0` (Allow from anywhere)
- On Render free tier, outbound IPs change — so allow all IPs

### ❌ Redis Connection Error
- Upstash TLS URLs start with `rediss://` (double-s) — verify yours
- Plain Redis (non-TLS) uses `redis://`

### ❌ Render Service Sleeps (Free Tier)
- Free services sleep after 15 min inactivity; first request takes ~30 sec to wake
- Fix: Use UptimeRobot (free) to ping `/health` every 5 minutes
- Or upgrade to Render Starter ($7/mo) for always-on

### ❌ "Page Not Found" on Refresh (Vercel)
- Make sure `lookbook-frontend/vercel.json` exists and is pushed:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

### ❌ Background Jobs Not Running
- Check Render logs: `REDIS_URL not configured — background jobs disabled`
- Verify `REDIS_URL` is set correctly in Render environment variables

---

## Deployment Architecture Summary

```
GitHub Repository (lookbook-project)
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
   Render.com                                  Vercel.com
   (lookbook-backend)                     (lookbook-frontend)
   ─────────────────                      ─────────────────
   • Node.js 20 runtime                   • Vite build → static dist/
   • npm install && npm run build         • React + Tailwind + React Router
   • node dist/server.js                  • SPA routing via vercel.json
   • Port 5000                            • Served via Vercel CDN
         │
         ├──► MongoDB Atlas (your existing cluster)
         ├──► Redis / Upstash (your existing instance)
         └──► Cloudinary (your existing account)
```

---

*Last updated: August 2026*
