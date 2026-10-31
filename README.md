# 🏮 Khang Chinese Restaurant & Dimsum

> Full-stack food-ordering platform — **React 19 frontend**, **Supabase backend**
> (Postgres + Auth + Edge Functions), **Razorpay payments**, and **order emails**
> to the customer and to **sultham456@gmail.com**.

<div align="center">

`康 · Khang · Chinese · Dimsum`

**Authentic Chinese flavors, crafted fresh.**

[Frontend](./frontend) · [Supabase backend](./supabase) · [Deployment](./DEPLOYMENT.md)

</div>

---

## 📁 Two folders, one backend

```
khang/
├── frontend/     React 19 · TypeScript · Vite 7 · Tailwind 4
└── supabase/     Postgres schema, RLS, seed, Edge Functions, CLI config
```

There is no application server to deploy and no database to host separately:
Supabase *is* the backend. The browser talks to it directly with the anon key —
row level security decides what each request may see — and the three operations
that need secrets (pricing + email, Razorpay, the payment webhook) run in Edge
Functions.

The project is **`nnyokeivsnvbbxzfqexf`** ·
<https://supabase.com/dashboard/project/nnyokeivsnvbbxzfqexf>.

### Commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run db:push` | links that project and applies `supabase/migrations/` |
| `npm run db:types` | regenerates `frontend/src/lib/database.types.ts` from it |
| `npm run functions:deploy` | deploys `create-order`, `razorpay`, `razorpay-webhook` |
| `npm run setup:sql` | rebuilds `supabase/setup.sql` after a migration edit |
| `npm run dev` | the frontend on <http://localhost:5173> |
| `npm run mock` | the dev-only stand-in for Supabase on `:5000` |
| `npm run check` | typecheck + production build |

## ✅ Feature checklist

| Area | Status |
|---|---|
| Restaurant landing page with cinematic intro (diner, eating, brand clip) | ✅ |
| Live menu from Postgres (`products`) | ✅ |
| Category filter, price sort, instant search | ✅ |
| Product detail modal, veg/spice indicators | ✅ |
| Cart drawer with 5% GST + ₹40 delivery (free over ₹500) | ✅ |
| Sign up / sign in with **Supabase Auth** | ✅ |
| **Signup emails stored in `auth.users` + `profiles`** (unique, indexed) | ✅ |
| Session restored and validated on reload | ✅ |
| Checkout requires a real account | ✅ |
| Server-side price recalculation in Postgres (`place_order`) | ✅ |
| **Razorpay** — UPI, cards, wallets, netbanking | ✅ |
| HMAC-SHA256 signature verification in an Edge Function | ✅ |
| Razorpay webhook (`payment.captured` / `failed`) | ✅ |
| Cash on delivery | ✅ |
| **Customer receipt email** after confirmation | ✅ |
| **Owner order email → sultham456@gmail.com** | ✅ |
| Idempotent emails (won't send twice on retry) | ✅ |
| Live order tracking with 30 s refresh | ✅ |
| Order history (“My Orders”) | ✅ |
| Admin dashboard — orders, revenue, status updates | ✅ |
| Refund action on the `razorpay` function (admin call; no dashboard button yet) | ✅ |
| Newsletter signup stored in `newsletter_subscribers` | ✅ |
| Reviews from Postgres (curated fallback) | ✅ |
| Row level security on every table | ✅ |
| Responsive mobile UI + floating cart | ✅ |

### Behaviour when the backend is unreachable

The menu falls back to the curated list in `src/data/menu.ts` so the page is
never empty; checkout is disabled until live data arrives, because an order
must reference real product ids.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19.2, TypeScript 5.9, Vite 7.3, Tailwind CSS 4.1 |
| Data | Supabase Postgres 15, row level security, SQL functions |
| Auth | Supabase Auth (email + password) |
| Server logic | Supabase Edge Functions (Deno) |
| Payments | Razorpay Checkout + HMAC verification |
| Email | Resend API (from an Edge Function) |
| Hosting | Vercel / Netlify (static frontend) + Supabase |

## 🚀 Quick start

### 1. Supabase — project `nnyokeivsnvbbxzfqexf`

```bash
# database (migrations in order)
npm run db:push            # link --project-ref nnyokeivsnvbbxzfqexf + db push

# …or, without the CLI: paste supabase/setup.sql into the SQL Editor
#     (dashboard → SQL editor → New query → Run) — migrations + seed in one file
```

Edge Functions:

```bash
npm run functions:deploy   # create-order, razorpay, razorpay-webhook
```

Full walkthrough: [`supabase/README.md`](./supabase/README.md) ·
Dashboard: <https://supabase.com/dashboard/project/nnyokeivsnvbbxzfqexf>

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # then fill in the two Supabase values
npm install
npm run dev               # http://localhost:5173
```

```env
VITE_SUPABASE_URL=https://nnyokeivsnvbbxzfqexf.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key from Project Settings → API>
```

Until the key is filled in, the dev build uses the bundled in-memory stand-in
(`npm run mock` in a second terminal) — menu, signup, COD orders, tracking,
admin — so the UI is never blocked on credentials.

### 3. Edge Function secrets

```bash
npx supabase secrets set RAZORPAY_KEY_ID=… RAZORPAY_KEY_SECRET=… \
  RAZORPAY_WEBHOOK_SECRET=… RESEND_API_KEY=… \
  EMAIL_FROM="Khang <orders@yourdomain.com>"
```

### 4. Make yourself an admin

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```

## 🔧 Environment variables

### Frontend (`frontend/.env`)

| Key | What it is |
|---|---|
| `VITE_SUPABASE_URL` | Project URL — `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon public key (safe in the browser; RLS is the gate) |
| `VITE_PREVIEW_API` | *dev only* — REST base for the local mock when Supabase is unset |

### Edge Function secrets (`supabase secrets set`)

| Key | Used by |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `razorpay`, `razorpay-webhook` |
| `RAZORPAY_WEBHOOK_SECRET` | `razorpay-webhook` |
| `RESEND_API_KEY`, `EMAIL_FROM` | `create-order`, `razorpay`, `razorpay-webhook` |
| `ORDER_NOTIFY_EMAIL` | defaults to `sultham456@gmail.com` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — never set them by hand, and never ship the service-role key to
the browser.

## 💳 Razorpay

1. Dashboard → **Settings → API Keys** → generate (test mode first).
2. `supabase secrets set RAZORPAY_KEY_ID=rzp_test_… RAZORPAY_KEY_SECRET=…`
3. Webhook: **Settings → Webhooks** → add
   `https://<ref>.supabase.co/functions/v1/razorpay-webhook`,
   events `payment.captured`, `payment.failed`, and copy the signing secret into
   `RAZORPAY_WEBHOOK_SECRET`.

The key secret never reaches the browser: the Edge Function creates the
Razorpay order and verifies the signature, then calls `mark_order_paid()`.

## 📧 Order emails

Every confirmed order sends two messages from an Edge Function:

- a receipt to the customer's account email;
- the kitchen copy to `ORDER_NOTIFY_EMAIL` (default **sultham456@gmail.com**).

`orders.customer_email_sent_at` / `owner_email_sent_at` make retries idempotent:
a replayed webhook or a repeated verification never emails twice.

## 🗄 Database

Four migrations, applied in order:

| File | What it creates |
|---|---|
| `…_schema.sql` | tables, enums, indexes, triggers (profile creation, rating rollups) |
| `…_functions.sql` | `place_order`, `mark_order_paid`, `track_order`, refunds, newsletter |
| `…_rls.sql` | row level security for every table |
| `…_order_reads.sql` | `my_orders`, `get_my_order`, `admin_list_orders` |

Then `supabase/seed.sql` for the 17 dishes, 5 categories and 4 house reviews.

`supabase/setup.sql` is those five files stitched into one paste for the SQL
Editor — generated by `npm run setup:sql`, never edited by hand.

```
profiles ──┐
           ├── orders ──┬── order_items ── products ── categories
auth.users ┘            └── order_tracking
products ── reviews        newsletter_subscribers
```

## 🔐 Security summary

- Prices, tax and delivery are computed in `place_order()` from the menu table;
  the cart's numbers are never trusted.
- Every table has RLS. Orders and their lines are visible only to their owner
  (or an admin); newsletter rows are readable by nobody.
- Order writes go through `SECURITY DEFINER` functions, so there is no insert
  path from the browser.
- Razorpay signatures are verified with a constant-time comparison; the webhook
  verifies its own HMAC.
- Profile role changes from the client are silently ignored.

## 🧪 Testing checklist

- [ ] Sign up → a row appears in `auth.users` **and** `profiles`
- [ ] Add a dish → cart shows 5% GST, ₹40 delivery (free over ₹500)
- [ ] Cash on delivery → order appears in "My Orders", two emails sent
- [ ] UPI/card → Razorpay popup opens, verification marks the order paid
- [ ] Close the tab mid-payment → the webhook still marks it paid
- [ ] `/track` with the order id shows the timeline
- [ ] Another account cannot read that order (RLS)
- [ ] Admin dashboard lists every order and can move one to *preparing*
- [ ] Newsletter subscribe → row in `newsletter_subscribers`

## 🆘 Troubleshooting

| Symptom | Fix |
|---|---|
| “Supabase is not configured” | `.env` has no `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| Menu empty but login works | seed missing — run `supabase/seed.sql` |
| Signup says “check your inbox” | project has *Confirm email* on; confirm, or turn it off in Auth → Providers |
| “Razorpay is not configured” | secrets not set, or functions not redeployed |
| Payments succeed but order stays pending | webhook URL/secret wrong; the client-side verify should still have caught it |
| Emails missing | `RESEND_API_KEY` unset or `EMAIL_FROM` domain not verified |

## 📜 License

MIT — see [LICENSE](./LICENSE) if present.

## 🙏 Credits

Menu copy, dish names and photography curated for the Khang restaurant brand.
Illustration traced from the supplied artwork; all custom type is outlined
vector, so nothing depends on a webfont.
