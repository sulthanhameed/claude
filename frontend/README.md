# 🎨 Khang Frontend

> React 19 · TypeScript · Vite 7 · Tailwind CSS v4 — the customer-facing restaurant app.
> Talks to the Express API over REST, opens Razorpay Checkout, and uses MongoDB
> product ids for a real cart and checkout.

---

## 📁 Folder layout

```
frontend/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts            # dev proxy /api → localhost:5000
├── vercel.json               # one-click Vercel deploy
├── .env.example
└── src/
    ├── App.tsx               # providers + section composition
    ├── main.tsx
    ├── index.css             # Tailwind v4 theme tokens
    ├── components/           # 25 UI components
    │   ├── Navbar.tsx / Hero.tsx / FeaturedCarousel.tsx
    │   ├── MenuSection.tsx   # live menu from MongoDB
    │   ├── FoodCard.tsx / FoodDetailModal.tsx
    │   ├── CartDrawer.tsx
    │   ├── CheckoutModal.tsx # Razorpay + COD, real order creation
    │   ├── AuthModal.tsx / UserMenu.tsx
    │   ├── MyOrdersModal.tsx # order history (/orders/me)
    │   ├── OrderTracking.tsx # live status (/orders/track/:id)
    │   ├── AdminDashboard.tsx
    │   ├── SearchModal.tsx
    │   ├── Reviews.tsx / Footer.tsx (newsletter API)
    │   └── …
    ├── context/
    │   ├── AuthContext.tsx   # JWT + session validation
    │   ├── MenuContext.tsx   # products from REST, static fallback
    │   └── CartContext.tsx
    ├── lib/
    │   ├── api.ts            # typed REST client
    │   ├── payments.ts       # create order → Razorpay → verify
    │   └── razorpay.ts       # SDK loader
    ├── data/menu.ts          # fallback menu (used only if API is down)
    ├── hooks/useScrollReveal.ts
    └── utils/cn.ts
```

---

## 🚀 Local development

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # → http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:5000`, so **no CORS setup is
needed** and `VITE_API_URL` can stay `/api`.

Start the backend first (see [`../backend/README.md`](../backend/README.md)).

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run build` | Production build → single `dist/index.html` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc --noEmit` |

---

## 🔧 Environment variables

```env
# Local default — Vite proxy handles the backend
VITE_API_URL=/api
VITE_PROXY_TARGET=http://localhost:5000

# Production (set in Vercel / Netlify dashboard)
# VITE_API_URL=https://khang-api.onrender.com/api
```

`VITE_*` values are baked in at build time — redeploy after changing them.

---

## 🔌 Backend integration

| Feature | Source | Endpoint |
|---|---|---|
| Menu | MongoDB | `GET /products` |
| Search | Local filter of live products | — |
| Signup / login | MongoDB `users` | `POST /auth/signup`, `/auth/login` |
| Session | JWT in `localStorage` | `GET /auth/me` |
| Cart | Client state, product `_id` as key | — |
| Checkout | Express | `POST /orders` |
| Payment | Razorpay Checkout | `POST /payments/razorpay/create-order` + `/verify` |
| Order history | MongoDB `orders` | `GET /orders/me` |
| Live tracking | MongoDB `orders` | `GET /orders/track/:orderId` (30s auto-refresh) |
| Reviews | MongoDB `reviews` | `GET /reviews` |
| Newsletter | MongoDB `subscribers` | `POST /newsletter` |
| Admin | Admin JWT | `GET /orders`, `PUT /orders/:id/status` |

### Behaviour when the API is down

- The menu falls back to a curated static list for browsing.
- The checkout button is **disabled** with a retry prompt — fake orders are never
  shown and nothing is written to the database.
- Sign-in fails with a clear error instead of creating a fake local session.
- A banner appears in the menu section with the connection error.

---

## 💳 Checkout flow

```
Cart (MongoDB _id + qty)
   ↓
POST /api/orders                      ← signed-in user required
   ↓  order KH-2026-XXXX (payment pending)
COD?  → success screen + emails
   ↓  otherwise
POST /api/payments/razorpay/create-order
   ↓  Razorpay Checkout popup (UPI / card / wallet / netbanking)
POST /api/payments/razorpay/verify   ← HMAC verified by the backend
   ↓
Success screen with order id + confirmation email destination
   ↓
OrderTracking section auto-loads the new order
```

The confirmation email always goes to the **account email stored in MongoDB**,
and the restaurant owner receives a copy at `ORDER_NOTIFY_EMAIL`
(default `sultham456@gmail.com`).

---

## 🎨 Build & deploy

```bash
npm run build
# dist/index.html — ~105 KB gzipped, CSS + JS inlined
```

### Vercel

1. Import the repo
2. **Root Directory:** `frontend`
3. Framework preset: **Vite**
4. Env: `VITE_API_URL=https://<your-render-api>/api`
5. Deploy (`vercel.json` already contains SPA rewrites + security headers)

Any static host works — upload the `dist/` folder.

---

## 🧪 Testing checklist

- [ ] Menu loads with 17 dishes from the API (not fallback)
- [ ] Signup stores the email in `users`; duplicate email returns 409
- [ ] Cart uses MongoDB product ids (check DevTools → Network → `POST /orders`)
- [ ] Razorpay test card `4111 1111 1111 1111` / OTP `1234` completes
- [ ] Confirmation appears at `sultham456@gmail.com`
- [ ] Tracking shows real statuses; admin can advance them
- [ ] Newsletter subscription appears in the `subscribers` collection
- [ ] Mobile layout, search, cart drawer and admin dashboard work

---

MIT © Khang
