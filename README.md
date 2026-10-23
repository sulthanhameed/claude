# 🏮 Khang Chinese Restaurant & Dimsum

> Full-stack food-ordering platform — **React 19 frontend**, **Express REST API**,
> **MongoDB database**, **Razorpay payments**, and **order emails** to the customer
> and to **sultham456@gmail.com**.

<div align="center">

`康 · Khang · Chinese Restaurant & Dimsum`

**Authentic Chinese flavors, crafted fresh.**

[Frontend](./frontend) · [Backend](./backend) · [Database](./database) · [Deployment](./DEPLOYMENT.md)

</div>

---

## 📁 Three separate folders

```
khang/
│
├── 🎨 frontend/                  # React 19 + TypeScript + Vite + Tailwind v4
│   ├── src/
│   │   ├── components/           # 25 UI components
│   │   ├── context/              # Auth, Cart, Menu (live API)
│   │   ├── lib/                  # api.ts, payments.ts, razorpay.ts
│   │   └── data/menu.ts          # offline fallback only
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts            # /api proxy → localhost:5000
│   ├── vercel.json               # Vercel hosting config
│   ├── .env.example
│   └── README.md
│
├── ⚙️ backend/                   # Node.js + Express + Mongoose
│   ├── src/
│   │   ├── server.js             # Express bootstrap + Razorpay webhook
│   │   ├── config/db.js
│   │   ├── models/               # User, Category, Product, Order, Review, Subscriber
│   │   ├── controllers/          # auth, products, orders, payments, reviews, newsletter
│   │   ├── routes/
│   │   ├── middleware/           # JWT auth, admin, error handler
│   │   ├── utils/                # JWT, order ID, email notifications
│   │   └── scripts/seed.js
│   ├── Dockerfile
│   ├── Procfile                  # Railway / Heroku
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── 🗄 database/                  # MongoDB design + seeds + docs
│   ├── schema/                   # JSON Schema per collection
│   ├── seed/                     # categories, products, admin
│   ├── migrations/001-initial.js # indexes
│   ├── scripts/                  # seed.sh, backup.sh
│   ├── docs/                     # ER diagram, index reference
│   └── README.md
│
├── render.yaml                   # Render Blueprint (backend service)
├── docker-compose.yml            # Mongo + API + frontend in one command
├── DEPLOYMENT.md                 # Step-by-step hosting guide
└── README.md
```

There is **no shared root app** — each folder can be deployed independently.

---

## ✅ Feature checklist

| Area | Status |
|---|---|
| Restaurant landing page with cinematic animations | ✅ |
| Live menu loaded from MongoDB (`GET /api/products`) | ✅ |
| Category filter, price sort, instant search | ✅ |
| Product detail modal, veg/spice indicators | ✅ |
| Cart drawer with 5% GST + ₹40 delivery (free over ₹500) | ✅ |
| Sign up / sign in with JWT | ✅ |
| **Signup emails stored in MongoDB** (unique, indexed) | ✅ |
| Session validation against `/auth/me` | ✅ |
| Checkout requires a real account | ✅ |
| Server-side price recalculation (no tampering) | ✅ |
| **Razorpay** — UPI, cards, wallets, netbanking | ✅ |
| HMAC-SHA256 signature verification | ✅ |
| Razorpay webhook (`payment.captured` / `failed`) | ✅ |
| Cash on delivery | ✅ |
| **Customer receipt email** after confirmation | ✅ |
| **Owner order email → sultham456@gmail.com** | ✅ |
| Duplicate-email protection / idempotent retries | ✅ |
| Live order tracking with 30s refresh | ✅ |
| Order history (“My Orders”) | ✅ |
| Admin dashboard — orders, revenue, status updates | ✅ |
| Refund API (admin) | ✅ |
| Newsletter signup stored in `subscribers` | ✅ |
| Reviews from MongoDB (curated fallback) | ✅ |
| Responsive mobile UI + floating cart | ✅ |
| Separate hosting configs for frontend / backend / database | ✅ |

### Behaviour when the API is offline

The menu shows a curated fallback list, **checkout is disabled** with a retry
prompt, and sign-in shows a real error. No fake orders, no fake accounts.

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4 |
| State | React Context (Auth, Cart, Menu) |
| Backend | Node.js 18+, Express 4, Mongoose 8 |
| Database | MongoDB (Atlas or local Docker) |
| Auth | JWT (HS256, 7d) + bcrypt (10 rounds) |
| Payments | Razorpay Checkout JS + Razorpay Node SDK |
| Email | Nodemailer + Gmail SMTP (App Password) |
| Security | Helmet, CORS allow-list, express-rate-limit |
| Hosting | Vercel (frontend), Render (API), MongoDB Atlas |

---

## 🚀 Quick start (local)

### 1. Database

```bash
# Option A — Docker
docker run -d --name khang-mongo -p 27017:27017 -v khang-data:/data/db mongo:7

# Option B — MongoDB Atlas free M0 cluster
# https://www.mongodb.com/atlas
```

### 2. Backend

```bash
cd backend
cp .env.example .env         # MONGO_URI, JWT_SECRET, Razorpay, Gmail
npm install
npm run seed                 # 5 categories + 17 dishes + admin
npm run dev                  # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env         # VITE_API_URL=/api
npm install
npm run dev                  # http://localhost:5173
```

Open **http://localhost:5173**.

- Admin: `admin@khang.com` / `admin123` (change this!)
- Signup with any email → stored in the `users` collection
- Add dishes → checkout → sign in → pay with Razorpay test card
  `4111 1111 1111 1111`, OTP `1234`

### One-command Docker stack

```bash
docker compose up --build
# frontend :5173 · API :5000 · MongoDB :27017
```

---

## 🔧 Environment variables

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | Backend base URL (Vite proxy in dev) |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | Dev proxy target |

Production: `VITE_API_URL=https://<render-api>.onrender.com/api`

### Backend (`backend/.env`)

See [`backend/.env.example`](./backend/.env.example). Minimal set:

```env
MONGO_URI=...
JWT_SECRET=...
CLIENT_URL=http://localhost:5173

RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=sultham456@gmail.com
EMAIL_PASS=<gmail app password>
EMAIL_FROM="Khang Restaurant <sultham456@gmail.com>"
ORDER_NOTIFY_EMAIL=sultham456@gmail.com

ADMIN_EMAIL=admin@khang.com
ADMIN_PASSWORD=<strong password>
```

Full table: [`backend/README.md`](./backend/README.md#-environment-variables).

---

## 💳 Razorpay integration

```
1. User signs in and clicks "Pay ₹X Securely"
2. POST /api/orders                          → pending order KH-2026-XXXX
3. POST /api/payments/razorpay/create-order  → Razorpay order (paise)
4. Razorpay Checkout popup (UPI / card / wallet / netbanking)
5. POST /api/payments/razorpay/verify        → HMAC-SHA256 checked
6. Order marked paid → customer receipt + owner alert emailed
7. Admin sees the PAID order in the dashboard
```

### Keys

1. [Razorpay Dashboard](https://dashboard.razorpay.com) → **API Keys** → Generate **Test Key**
2. Add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
3. Webhook (recommended):
   - URL `https://<api>/api/payments/razorpay/webhook`
   - Events `payment.captured`, `payment.failed`
   - Secret → `RAZORPAY_WEBHOOK_SECRET`
4. Test card `4111 1111 1111 1111` · CVV `123` · OTP `1234`

### Security

- HMAC signature verified server-side with `timingSafeEqual`
- Payment must belong to the logged-in user and the stored Razorpay order id
- Amounts always recalculated from MongoDB prices
- Idempotent verify + webhook (safe retries)
- Full refunds available to admins (`POST /api/payments/refund`)

---

## 📧 Order confirmation emails

Every **confirmed** order (COD immediately, online after verification) sends:

| Recipient | Content |
|---|---|
| Customer (`users.email`) | Receipt: order id, items, totals, delivery address |
| **`sultham456@gmail.com`** (`ORDER_NOTIFY_EMAIL`) | New-order alert with customer contact + full order |

- Gmail App Password required (not your normal password)
- Customer signup emails are stored in MongoDB and reused for receipts
- Email delivery flags on each order prevent duplicates
- If email is not configured, checkout still works; `/health` reports `emailConfigured: false`

Gmail setup: [`DEPLOYMENT.md`](./DEPLOYMENT.md#-step-5--order-emails-gmail).

---

## 🗄 Database

Five core collections + newsletter:

| Collection | Purpose | Key indexes |
|---|---|---|
| `users` | Customers + admins, emails, hashed passwords | `email` unique |
| `categories` | 5 menu categories | `slug` unique, `sortOrder` |
| `products` | 17 dishes | `slug` unique, `category`, `featured` |
| `orders` | Orders, Razorpay ids, tracking, email flags | `orderId` unique, `user`, `status`, `payment.status` |
| `reviews` | Ratings/text per product/user | `(user, product)` unique |
| `subscribers` | Newsletter emails | `email` unique |

See [`database/README.md`](./database/README.md) for schemas, seed data,
ER diagram and index reference.

### Seed

```bash
cd backend
npm run seed                    # safe upsert
npm run seed:force              # reset menu and reseed
```

Admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default
`admin@khang.com` / `admin123`).

---

## 📚 API summary

Base: `/api`

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `GET/PUT /auth/me` |
| Products | `GET /products`, `GET /products/meta/categories`, `GET /products/:slug`, admin CRUD |
| Orders | `POST /orders`, `GET /orders/me`, `GET /orders/:orderId`, `GET /orders/track/:orderId`, admin list/status |
| Payments | `POST /payments/razorpay/create-order`, `/verify`, `/webhook`, `POST /payments/refund` |
| Reviews | `GET /reviews`, `POST /reviews`, `DELETE /reviews/:id` |
| Newsletter | `POST /newsletter`, admin list/unsubscribe |
| Ops | `GET /health`, `GET /api` |

Full contract with request bodies: [`backend/README.md`](./backend/README.md#-rest-api).

---

## 🌐 Deployment (separate hosts)

| Part | Host | Root directory | Config |
|---|---|---|---|
| Frontend | **Vercel** | `frontend` | `frontend/vercel.json` |
| Backend | **Render** | `backend` | `render.yaml` |
| Database | **MongoDB Atlas** | — | `database/` |

**Step-by-step guide:** [`DEPLOYMENT.md`](./DEPLOYMENT.md)

Short version:

```bash
# 1. Seed Atlas
cd backend
MONGO_URI="mongodb+srv://..." ADMIN_EMAIL="you@example.com" \
  ADMIN_PASSWORD="strong-password" npm run seed

# 2. Render: root=backend, build=npm ci, start=npm start
#    env: MONGO_URI, JWT_SECRET, CLIENT_URL, RAZORPAY_*, EMAIL_*

# 3. Vercel: root=frontend, env VITE_API_URL=https://<api>/api

# 4. Render: set CLIENT_URL=https://<frontend-domain>, redeploy
```

Hosting files included:

- `frontend/vercel.json`
- `render.yaml` (Render Blueprint, root of repo)
- `backend/Dockerfile` + `.dockerignore`
- `backend/Procfile`
- `docker-compose.yml`

---

## 🔒 Security summary

- bcrypt password hashing, passwords never serialised
- JWT HS256 with 7-day expiry, role-based access (`user` / `admin`)
- Razorpay HMAC signature verification (timing-safe)
- Server-side totals; quantities capped; only valid ObjectIds accepted
- CORS allow-list via `CLIENT_URL`
- Helmet headers + request body limits
- Rate limiting on all APIs, stricter on auth
- Owner/admin checks on order reads and management
- HTML escaping in transactional emails
- Secrets only in environment variables (`.env` git-ignored)

---

## 🧪 Testing checklist

- [ ] Menu loads live products (not the offline fallback)
- [ ] Signup stores the email; duplicate email returns 409
- [ ] Sign-in fails with a real error for wrong credentials
- [ ] Cart sends MongoDB `_id`s in `POST /orders`
- [ ] Razorpay test payment → order `paid`
- [ ] Order email arrives at `sultham456@gmail.com`
- [ ] Tracking shows the real status
- [ ] Admin can advance order status
- [ ] Newsletter email appears in `subscribers`
- [ ] Mobile layout + search + cart work

---

## 🆘 Troubleshooting

| Symptom | Fix |
|---|---|
| Menu shows fallback / checkout disabled | API unreachable — check `VITE_API_URL`, `/health`, and `npm run seed` |
| CORS error | Add the exact frontend origin to `CLIENT_URL` on Render |
| `Razorpay is not configured` | Add both keys and redeploy |
| No order email | Gmail App Password missing/invalid; check spam |
| Emails not going to the owner | Set `ORDER_NOTIFY_EMAIL=sultham456@gmail.com` |
| `MongoDB connection failed` | Atlas IP allow-list + URI password |
| 401 after refresh | Token expired; sign in again |
| Admin dashboard 403 | Account role isn't `admin`; reseed or update the user |

More: [`DEPLOYMENT.md`](./DEPLOYMENT.md#-troubleshooting).

---

## 📜 License

MIT — free to use as a starting point for your own restaurant.

## 🙏 Credits

- Imagery & video — [Pexels](https://www.pexels.com)
- Fonts — [Google Fonts](https://fonts.google.com): Playfair Display, Outfit, Manrope, Space Grotesk, Ma Shan Zheng
- Payments — [Razorpay](https://razorpay.com)
- Inspired by Khang Restaurant ([@khang.resto](https://www.instagram.com/khang.resto))

---

<div align="center">

`康` · *Food made with patience tastes of love.* · `福`

</div>
