# ⚙️ Khang Backend

> Express 4 + MongoDB (Mongoose 8) REST API for Khang Chinese Restaurant & Dimsum.
> Razorpay payments, JWT auth, transactional email, order tracking and an admin API.

---

## 📁 Folder layout

```
backend/
├── src/
│   ├── server.js                 # Express bootstrap, CORS, rate limits, Razorpay webhook
│   ├── config/db.js              # MongoDB connection
│   ├── models/
│   │   ├── User.js               # email + bcrypt password + role
│   │   ├── Product.js
│   │   ├── Category.js
│   │   ├── Order.js              # Razorpay fields, tracking, email flags
│   │   ├── Review.js
│   │   └── Subscriber.js         # newsletter emails
│   ├── controllers/
│   │   ├── authController.js     # signup / login / me
│   │   ├── productController.js  # menu + search + categories
│   │   ├── orderController.js    # server-side totals, tracking, admin list
│   │   ├── paymentController.js  # Razorpay create/verify/webhook/refund
│   │   ├── reviewController.js
│   │   └── newsletterController.js
│   ├── routes/                   # REST route definitions
│   ├── middleware/
│   │   ├── auth.js               # JWT protect + adminOnly
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── generateOrderId.js
│   │   └── notifications.js      # customer receipt + owner order alert
│   └── scripts/seed.js           # idempotent menu + admin seed
├── Dockerfile
├── Procfile                      # Railway / Heroku
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Local setup

```bash
cd backend
cp .env.example .env          # fill MONGO_URI + JWT_SECRET
npm install
npm run seed                  # inserts 5 categories, 17 dishes, admin user
npm run dev                   # http://localhost:5000
```

Check it:

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/products
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Nodemon dev server |
| `npm start` | Production server |
| `npm run seed` | Upsert menu + admin (safe to re-run) |
| `npm run seed:force` | Delete products/categories first, then seed |

---

## 🔧 Environment variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | — | `production` on Render |
| `PORT` | — | Defaults to `5000` (Render injects its own) |
| `HOST` | — | `0.0.0.0` |
| `MONGO_URI` | ✅ | MongoDB Atlas / local connection string |
| `CLIENT_URL` | ✅ | Frontend origin(s), comma-separated. `*` allows all |
| `JWT_SECRET` | ✅ | Long random string |
| `JWT_EXPIRES_IN` | — | Default `7d` |
| `RAZORPAY_KEY_ID` | ✅* | Razorpay key id |
| `RAZORPAY_KEY_SECRET` | ✅* | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | — | For `/api/payments/razorpay/webhook` |
| `EMAIL_HOST` | — | `smtp.gmail.com` |
| `EMAIL_PORT` | — | `587` (STARTTLS) or `465` (SSL) |
| `EMAIL_SECURE` | — | `true` for port 465 |
| `EMAIL_USER` | — | Gmail address |
| `EMAIL_PASS` | — | Gmail **App Password** (16 chars) |
| `EMAIL_FROM` | — | `"Khang Restaurant <you@gmail.com>"` |
| `ORDER_NOTIFY_EMAIL` | — | Owner inbox. **Defaults to `sultham456@gmail.com`** |
| `ADMIN_NAME` | — | Seed admin display name |
| `ADMIN_EMAIL` | — | Seed admin login (default `admin@khang.com`) |
| `ADMIN_PASSWORD` | — | Seed admin password (default `admin123` — change it!) |
| `ADMIN_RESET_PASSWORD` | — | `true` to overwrite an existing admin password on the next seed |
| `MONGO_AUTO_INDEX` | — | Defaults to `true` |

\* Online payments require both Razorpay keys. COD works without them.

---

## 📚 REST API

Base URL: `/api`. Protected routes need `Authorization: Bearer <JWT>`.

### Auth

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/auth/signup` | — | `{ name, email, password, phone? }` → `{ token, user }` |
| POST | `/auth/login` | — | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | JWT | Current user |
| PUT | `/auth/me` | JWT | `{ name?, phone? }` |
| POST | `/auth/logout` | — | Client clears its token |

Signup emails are stored in the `users` collection with a unique index.

### Products

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/products` | — | `?category=&q=&featured=true&sort=popular\|low\|high` |
| GET | `/products/meta/categories` | — | Categories ordered by `sortOrder` |
| GET | `/products/:slug` | — | Product + latest 20 reviews |
| POST | `/products` | admin | Create |
| PUT | `/products/:id` | admin | Update |
| DELETE | `/products/:id` | admin | Delete |

### Orders

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/orders` | JWT | Creates a **pending** order, recalculates totals server-side |
| GET | `/orders/me` | JWT | Logged-in user's orders |
| GET | `/orders/:orderId` | JWT | Owner or admin only |
| GET | `/orders/track/:orderId` | — | Public, limited fields |
| GET | `/orders` | admin | `?status=received` |
| PUT | `/orders/:id/status` | admin | `{ status, note? }` |

Valid statuses: `received`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`.
Marking a COD order `delivered` also records payment as collected.

### Payments (Razorpay)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/razorpay/create-order` | JWT | `{ orderId }` → key + Razorpay order id + amount |
| POST | `/payments/razorpay/verify` | JWT | HMAC-SHA256 signature check → marks paid + emails |
| POST | `/payments/razorpay/webhook` | signature | Raw-body webhook (`payment.captured`, `payment.failed`) |
| POST | `/payments/refund` | admin | `{ orderId }` → full Razorpay refund |

### Reviews

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/reviews` | — | `?product=slug&limit=20` |
| POST | `/reviews` | JWT | `{ productSlug, rating, text, location? }` |
| DELETE | `/reviews/:id` | JWT | Author or admin |

### Newsletter

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/newsletter` | — | `{ email }` → stored in `subscribers` |
| GET | `/newsletter` | admin | List subscribers |
| DELETE | `/newsletter/:id` | admin | Soft unsubscribe |

### Ops

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB + email + Razorpay configuration status |
| GET | `/api` | API index |

---

## 💳 Razorpay flow

```
POST /api/orders                     → pending order + friendly KH-YYYY-XXXX id
POST /api/payments/razorpay/create-order
                                     → Razorpay order (amount in paise)
Razorpay Checkout popup (frontend)   → UPI / card / wallet / netbanking
POST /api/payments/razorpay/verify   → HMAC signature checked on the server
                                     → payment.status = "paid"
                                     → customer receipt + owner alert emailed
```

Security:

- HMAC-SHA256 verified with `crypto.timingSafeEqual`
- Payment must belong to the logged-in user and the Razorpay order id stored on the order
- Server recalculates every price, tax and delivery fee
- Idempotent verify + webhook (retries are safe)
- Webhook uses the **raw** body, mounted before `express.json()`

### Razorpay dashboard setup

1. Create an account at [razorpay.com](https://razorpay.com)
2. **Settings → API Keys → Generate Test Key**
3. Copy `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` into `.env`
4. Optional webhook: **Settings → Webhooks → Add**
   - URL: `https://<your-api-domain>/api/payments/razorpay/webhook`
   - Secret: put the same value in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`
5. Test card: `4111 1111 1111 1111`, any future expiry, CVV `123`, OTP `1234`

---

## 📧 Email notifications

Every confirmed order sends **two** emails:

1. **Customer receipt** to the email saved in the database (`users.email`)
2. **Owner alert** to `ORDER_NOTIFY_EMAIL` — defaults to **`sultham456@gmail.com`**

The owner email includes the customer's name, phone, email, delivery address, line
items and total. Duplicate sends are prevented with
`order.notifications.customerEmailSentAt` / `ownerEmailSentAt`.

### Gmail setup (free)

1. Enable **2-Step Verification** on the Google account
2. Google Account → **Security → App passwords**
3. Create an app password for **Mail**
4. Fill in:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=sultham456@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop     # app password, spaces optional
EMAIL_FROM="Khang Restaurant <sultham456@gmail.com>"
ORDER_NOTIFY_EMAIL=sultham456@gmail.com
```

If email is not configured, orders still succeed and the API logs a warning.
`GET /health` reports `emailConfigured`.

---

## 🔒 Security

- bcrypt password hashing (10 rounds), password never serialised
- JWT HS256, 7-day expiry, role-based access
- Razorpay HMAC signature verification with timing-safe comparison
- Server-side price/total calculation
- Helmet security headers, strict JSON body limit
- CORS allow-list from `CLIENT_URL`
- Global rate limit (600 / 15 min) and stricter auth limit (40 / 15 min)
- Owner-only order reads; admin-only management routes
- HTML escaping in emails (customer-supplied names/addresses)

---

## ☁️ Deploy to Render

The repository root contains `render.yaml`, a ready Blueprint pointing at this
`backend/` folder (`rootDir: backend`):

1. Push the repo to GitHub
2. Render → **New → Blueprint** → select the repo
3. Fill the `sync: false` env vars (`MONGO_URI`, `CLIENT_URL`, Razorpay, Gmail)
4. Deploy → health check at `/health`
5. Seed once from the Render Shell:

```bash
npm run seed
```

Detailed walkthrough: [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

### Docker

```bash
docker build -t khang-api .
docker run -p 5000:5000 --env-file .env khang-api
```

---

## 🧪 Troubleshooting

| Symptom | Fix |
|---|---|
| `MongoDB connection failed` | Atlas Network Access → allow `0.0.0.0/0`; check URI password |
| `Razorpay is not configured` | Add both Razorpay keys, restart |
| Orders work but no email | Set `EMAIL_USER`/`EMAIL_PASS` (Gmail App Password) |
| Browser CORS error | Add the exact frontend origin to `CLIENT_URL`, redeploy |
| Menu is empty on the site | Run `npm run seed` against the same `MONGO_URI` |
| Payment succeeds but order still pending | Webhook secret / verify endpoint; check server logs |

---

MIT © Khang
