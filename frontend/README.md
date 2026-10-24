# 🎨 Khang Frontend

> React 19 · TypeScript · Vite 7 · Tailwind CSS v4 — the customer-facing
> restaurant app. Talks to **Supabase** (Postgres + Auth + Edge Functions),
> opens Razorpay Checkout, and uses real product ids for a real cart.

---

## 📁 Folder layout

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts            # dev server + /api proxy for the local mock
├── vercel.json               # SPA rewrite + security headers
├── public/                   # brand SVGs, _redirects (Netlify)
├── .env.example
└── src/
    ├── App.tsx               # providers + section composition + routes
    ├── main.tsx
    ├── index.css             # Tailwind v4 theme tokens + intro styles
    ├── components/           # 25 UI components
    │   ├── Navbar / Hero / FeaturedCarousel / MenuSection
    │   ├── FoodCard / FoodDetailModal / CartDrawer
    │   ├── CheckoutModal     # Razorpay + COD through the Edge Functions
    │   ├── AuthModal / UserMenu
    │   ├── MyOrdersModal / OrderTracking / AdminDashboard
    │   ├── SearchModal / Reviews / Footer
    │   └── intro/            # the entrance film (diner, brand clip, /brand)
    ├── context/
    │   ├── AuthContext.tsx   # Supabase session + profile
    │   ├── MenuContext.tsx   # products from Supabase, static fallback
    │   └── CartContext.tsx
    ├── lib/
    │   ├── supabase.ts       # the client
    │   ├── api.ts            # typed data layer over Supabase (+ dev mock)
    │   ├── payments.ts       # order → Razorpay → verify
    │   └── razorpay.ts       # Checkout SDK loader
    ├── data/menu.ts          # fallback menu (used only if the project is down)
    ├── hooks/useScrollReveal.ts
    └── utils/cn.ts
```

---

## 🚀 Local development

```bash
cd frontend
cp .env.example .env        # fill in the two Supabase values
npm install
npm run dev                 # → http://localhost:5173
```

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

The anon key is designed for browsers — row level security is what protects the
data. Never put the service-role key here.

### Running without a Supabase project

Leave the two values empty and start the local REST mock:

```bash
node ../.preview/mock-api.mjs     # :5000, in-memory menu + orders
```

The dev build then uses its preview driver (`/api` → proxied to :5000 by
`vite.config.ts`). Production builds refuse to run without Supabase rather than
quietly pointing at a mock.

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run build` | Production build → single `dist/index.html` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc --noEmit` |

---

## 🔌 Where each feature gets its data

| Feature | Supabase object |
|---|---|
| Menu | `products` (select; RLS: public) |
| Search / filter / sort | query on `products` |
| Signup / login | `auth.signUp` / `auth.signInWithPassword` |
| Session | Supabase session + `profiles` row |
| Checkout | Edge Function `create-order` |
| Payment | Edge Function `razorpay` (create / verify) |
| Order history | RPC `my_orders()` |
| Live tracking | RPC `track_order(orderId)` (30 s auto-refresh) |
| Reviews | `reviews` (select) |
| Newsletter | RPC `subscribe_newsletter(email)` |
| Admin | RPC `admin_list_orders()`, `admin_set_order_status()` |

### Behaviour when the backend is unreachable

- The menu falls back to the curated list for browsing.
- Checkout is **disabled** with a retry prompt — fake orders are never written.
- Sign-in fails with a clear error rather than creating a fake session.
- The menu section shows the connection error.

---

## 🎬 The entrance

`components/intro/` holds the whole opening sequence:

- `IntroScene` — the traced diner, eating, on plain white (no room, no props).
- `IntroExperience` — the 8.85 s entrance: the meal, a dissolve, then the brand
  clip, then the hand-off to the page. Plays once per session (`?intro=1`
  replays, `?intro=0` skips), and reduced-motion visitors get the held frame.
- `BrandFilmPage` — the same name-and-logo clip on its own page at **`/brand`**,
  with Replay and “Enter the restaurant”.
