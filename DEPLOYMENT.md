# 🚀 Khang — Deployment Guide

Everything needed to host the three parts **separately**:

| Part | Folder | Recommended host | Hosting file |
|---|---|---|---|
| Frontend (React SPA) | `frontend/` | **Vercel** (or Netlify) | `frontend/vercel.json` |
| Backend (Express REST API) | `backend/` | **Render** (or Railway/Docker) | `render.yaml`, `backend/Dockerfile`, `backend/Procfile` |
| Database (MongoDB) | `database/` | **MongoDB Atlas** | `database/` docs, schemas, seed |

```
Browser
  │
  ├── https://khang.vercel.app          ← frontend/ (static build)
  │        │  fetch VITE_API_URL + /api/...
  │        ▼
  └── https://khang-api.onrender.com    ← backend/ (Express on Render)
           │  Mongoose
           ▼
     MongoDB Atlas cluster              ← database/ (M0 free tier)
           │
           ├── Razorpay (payments)
           └── Gmail SMTP (order emails → sultham456@gmail.com)
```

---

## 📦 Hosting files in this repo

| File | Purpose |
|---|---|
| `frontend/vercel.json` | Vercel build + SPA rewrites + security headers |
| `frontend/.env.example` | Frontend environment template |
| `render.yaml` | Render Blueprint (service, health check, env vars) |
| `backend/Dockerfile` | Container image for any Docker host |
| `backend/.dockerignore` | Keeps secrets/build junk out of the image |
| `backend/Procfile` | Railway / Heroku start command |
| `backend/.env.example` | Backend environment template |
| `docker-compose.yml` | Full local stack (Mongo + API + frontend) |
| `database/migrations/001-initial.js` | MongoDB indexes |
| `database/scripts/backup.sh` | `mongodump` backup helper |

---

## ✅ Step 0 — Prerequisites

- GitHub account (repo pushed)
- [MongoDB Atlas](https://www.mongodb.com/atlas) free account
- [Render](https://render.com) free account
- [Vercel](https://vercel.com) free account
- [Razorpay](https://razorpay.com) account (test mode is free)
- A Gmail account with an **App Password** for order emails

> You can deploy with COD working immediately. Razorpay and email are enabled
> as soon as their env vars are added — no code changes required.

---

## 🗄 Step 1 — MongoDB Atlas

1. Create a **free M0 cluster** (region closest to your users, e.g. Mumbai/Singapore).
2. **Database Access → Add New Database User**
   - Username: `khang`
   - Password: generate a strong one and save it
   - Role: **Read and write to any database**
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`).
   Render's outbound IPs are not fixed on the free plan.
4. **Connect → Drivers** → copy the connection string and add the database name:

```text
mongodb+srv://khang:<PASSWORD>@cluster0.xxxxx.mongodb.net/khang?retryWrites=true&w=majority
```

Replace `<PASSWORD>` with the URL-encoded password.

---

## 🌱 Step 2 — Seed the database

Run this once from your computer against Atlas:

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
MONGO_URI=mongodb+srv://khang:<PASSWORD>@cluster0.xxxxx.mongodb.net/khang?retryWrites=true&w=majority
JWT_SECRET=<generate-a-long-random-string>
ADMIN_EMAIL=admin@khang.com
ADMIN_PASSWORD=<choose-a-strong-password>
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Install and seed:

```bash
npm install
npm run seed
```

Expected output:

```
✓ 5 categories ready
✓ 17 products ready
✓ Admin created: admin@khang.com
🎉 Seed complete
```

> `npm run seed` is idempotent — re-running updates prices/details by slug and
> never deletes orders. Use `npm run seed:force` only if you want to reset the menu.

---

## ⚙️ Step 3 — Backend on Render

### 3.1 Create the service

**Option A — Blueprint (fastest):** Render Dashboard → **New → Blueprint** →
select the repo. Render reads the root `render.yaml`, creates the service with
`rootDir: backend`, then asks for the `sync: false` environment variables.

**Option B — Manual web service:** Render Dashboard → **New → Web Service**.

1. Repository: your GitHub repo
2. **Root Directory:** `backend`
3. **Runtime:** Node
4. **Build Command:** `npm ci`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/health`
7. **Instance Type:** Free (note: it sleeps after 15 minutes of inactivity)

### 3.2 Environment variables

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `MONGO_URI` | your Atlas URI |
| `JWT_SECRET` | long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://your-frontend.vercel.app` (comma-separate multiple) |
| `RAZORPAY_KEY_ID` | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | any strong secret (same in Razorpay dashboard) |
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_SECURE` | `false` |
| `EMAIL_USER` | `sultham456@gmail.com` |
| `EMAIL_PASS` | Gmail App Password |
| `EMAIL_FROM` | `Khang Restaurant <sultham456@gmail.com>` |
| `ORDER_NOTIFY_EMAIL` | `sultham456@gmail.com` |
| `ADMIN_EMAIL` | your admin email (seed only) |
| `ADMIN_PASSWORD` | your admin password (seed only) |

You can leave Razorpay/email empty for the first deploy; add them later and
redeploy.

### 3.3 Deploy and verify

After the deploy finishes:

```bash
curl https://<your-service>.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "database": "connected",
  "emailConfigured": true,
  "razorpayConfigured": true,
  "version": "1.0.0"
}
```

```bash
curl https://<your-service>.onrender.com/api/products
```

If the menu is empty, open **Render → Shell** and run `npm run seed`.

> **Free plan cold starts:** the first request after 15 minutes can take ~30s.
> Upgrade to the Starter instance for always-on hosting.

---

## 💳 Step 4 — Razorpay

1. [Razorpay Dashboard](https://dashboard.razorpay.com) → **Account & Settings → API Keys**
2. **Generate Test Key** → copy key id + secret into Render env vars
3. Create a webhook:
   - **Settings → Webhooks → Add New Webhook**
   - URL: `https://<your-render-api>/api/payments/razorpay/webhook`
   - Secret: same value as `RAZORPAY_WEBHOOK_SECRET`
   - Active events: `payment.captured`, `payment.failed`
4. Redeploy the backend.
5. Test with:
   - Card: `4111 1111 1111 1111`
   - Any future expiry, CVV `123`, OTP `1234`
   - UPI test id: `success@razorpay`

When you are ready for live payments, generate **Live Keys**, replace the two
env vars, create a live webhook and complete Razorpay KYC.

---

## 📧 Step 5 — Order emails (Gmail)

Every confirmed order sends:

1. a receipt to the **customer email stored in MongoDB**
2. a new-order alert to `ORDER_NOTIFY_EMAIL` (default **`sultham456@gmail.com`**)

Setup:

1. Sign in to `sultham456@gmail.com`
2. Enable **2-Step Verification**
3. **Google Account → Security → App passwords**
4. Create an app password named `Khang Website`
5. Copy the 16-character password (remove spaces) into Render as `EMAIL_PASS`
6. `EMAIL_USER` must be the same Gmail address
7. Redeploy → place a test order → check inbox/spam

Without email env vars, orders still work; the API logs a warning and
`/health` shows `emailConfigured: false`.

---

## 🎨 Step 6 — Frontend on Vercel

1. Vercel → **Add New → Project** → import the GitHub repo
2. **Root Directory:** `frontend`
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Environment variable:

```env
VITE_API_URL=https://<your-render-api>.onrender.com/api
```

7. **Deploy**
8. Copy the production URL, e.g. `https://khang.vercel.app`

`frontend/vercel.json` already handles SPA rewrites and security headers.

### Netlify alternative

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Env: `VITE_API_URL=https://<your-render-api>/api`

---

## 🔗 Step 7 — Connect them (CORS)

1. In Render, set:

```env
CLIENT_URL=https://khang.vercel.app
```

2. Save → Render redeploys.
3. Reload the frontend and hard-refresh the browser.

Multiple domains are allowed:

```env
CLIENT_URL=https://khang.vercel.app,https://khang.netlify.app,https://www.khang.com
```

Wildcards work for preview deployments:

```env
CLIENT_URL=*.vercel.app
```

For local testing against the deployed API, add `http://localhost:5173`:

```env
CLIENT_URL=https://khang.vercel.app,http://localhost:5173
```

---

## 🧪 Step 8 — End-to-end test

- [ ] `/health` returns `status: ok`, `database: connected`
- [ ] Frontend menu shows the seeded dishes (not the offline fallback)
- [ ] Signup saves the user in Atlas (`users` collection)
- [ ] Signup with the same email returns "Email already registered"
- [ ] Add 2 dishes → cart total matches backend calculation (5% GST, ₹40 delivery, free over ₹500)
- [ ] Checkout requires sign-in
- [ ] COD order → success screen + order id
- [ ] Razorpay test payment → success screen + order marked `paid`
- [ ] `sultham456@gmail.com` receives the new-order alert
- [ ] Customer inbox receives the receipt
- [ ] Tracking finds the order and auto-refreshes
- [ ] Admin dashboard (`admin@khang.com`) lists the order and can change status
- [ ] Footer newsletter subscription appears in the `subscribers` collection

---

## 🐳 Alternative — Docker / VPS

Full local stack:

```bash
docker compose up --build
# frontend http://localhost:5173
# API      http://localhost:5000
# Mongo    localhost:27017
```

Backend only:

```bash
cd backend
docker build -t khang-api .
docker run -p 5000:5000 --env-file .env khang-api
```

Then seed inside the container:

```bash
docker exec -it <container> node src/scripts/seed.js
```

---

## 🌐 Custom domain

1. Buy a domain (Namecheap, GoDaddy, Cloudflare…)
2. **Vercel → Project → Settings → Domains** → add `khang.com` and `www.khang.com`
3. Point DNS records as Vercel instructs
4. Add the live domain to `CLIENT_URL` on Render
5. Optional: Render custom domain `api.khang.com`, then set
   `VITE_API_URL=https://api.khang.com/api` and redeploy the frontend

---

## 🔐 Production checklist

- [ ] Change the seeded admin password (`ADMIN_PASSWORD` before seeding, or update in DB)
- [ ] Use a long random `JWT_SECRET`
- [ ] Restrict Atlas network access if you have static egress IPs
- [ ] Switch Razorpay test keys to live keys + complete KYC
- [ ] Use a Gmail App Password (never the main account password)
- [ ] Enable Razorpay webhooks so payments confirm even if the browser closes
- [ ] Set `CLIENT_URL` to the exact production origin (no trailing slash needed)
- [ ] Keep `.env` files out of Git (already ignored)
- [ ] Take periodic Atlas backups (`database/scripts/backup.sh`)
- [ ] Monitor `/health` with a free uptime checker

---

## 💰 Free-tier summary

| Service | Free tier | Limitation |
|---|---|---|
| MongoDB Atlas | M0 512 MB | Shared cluster |
| Render | Free web service | Sleeps after 15 min idle |
| Vercel | Hobby | 100 GB bandwidth/month |
| Razorpay | Test mode free | 2% + GST on live payments |
| Gmail SMTP | Free | ~500 emails/day |

---

## 🆘 Troubleshooting

| Problem | Cause / fix |
|---|---|
| `Failed to fetch` on the live site | Wrong `VITE_API_URL`; redeploy after fixing |
| CORS error in console | Frontend origin missing from `CLIENT_URL`; include `https://`, no trailing slash |
| Menu shows fallback dishes | Backend unreachable or database not seeded — check `/health` and run `npm run seed` |
| Checkout button disabled | Live menu not loaded; use "Retry connection" |
| `Razorpay is not configured` | Add both Razorpay keys and redeploy |
| No emails | `EMAIL_USER`/`EMAIL_PASS` missing; Gmail App Password required; check spam |
| Emails only to customer | Set `ORDER_NOTIFY_EMAIL=sultham456@gmail.com` |
| Order paid but status pending | Verify endpoint failed; check webhook secret and logs |
| Render 503 at `/health` | Mongo URI/network access wrong, or service still booting |
| Admin dashboard 403 | Account role is not `admin`; reseed with `ADMIN_EMAIL` |
| Images not loading | Pexels URLs blocked on your network — replace `image` fields |

---

## 📁 Quick command sheet

```bash
# Local full stack
docker compose up --build

# Backend only
cd backend && cp .env.example .env
npm install && npm run seed && npm run dev

# Frontend only
cd frontend && cp .env.example .env
npm install && npm run dev

# Production build
cd frontend && npm run build

# Seed production database
cd backend && MONGO_URI="<atlas-uri>" ADMIN_EMAIL="you@example.com" \
  ADMIN_PASSWORD="strong-password" npm run seed
```

Need the API contract? See [`backend/README.md`](./backend/README.md).
Need database details? See [`database/README.md`](./database/README.md).
