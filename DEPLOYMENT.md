# 🚀 Deploying Khang

Two deployments: **Supabase** (database, auth, functions) and a **static
frontend** (Vercel or Netlify). There is no API server to run.

```
   ┌─────────────────────────────┐        ┌──────────────────────────────┐
   │  khang.vercel.app           │        │  <ref>.supabase.co           │
   │  static Vite build          │ ──────▶│  Postgres · Auth · Functions │
   └─────────────────────────────┘        └──────────────┬───────────────┘
                                                         │
                                     Razorpay  ◀─────────┤ webhook
                                     Resend    ◀─────────┘ order emails
```

| Piece | Where | Config |
|---|---|---|
| Frontend (React SPA) | **Vercel** (or Netlify) | `frontend/vercel.json`, `frontend/public/_redirects` |
| Database + Auth + Functions | **Supabase** | `supabase/migrations`, `supabase/functions` |

---

## 1 · The Supabase project

This repo is wired to **`nnyokeivsnvbbxzfqexf`** —
<https://supabase.com/dashboard/project/nnyokeivsnvbbxzfqexf>.

1. **Project Settings → API** → copy the **anon public** key into
   `frontend/.env` (the URL is already the project's).
2. **Authentication → Providers → Email** — for a smooth demo, turn
   **Confirm email** off. Leave it on for production; the app then tells the
   guest to confirm before signing in.

Making a *new* project instead? Create it, then change the ref in
`package.json` (`db:push`, `db:types`), `frontend/.env` and `.mcp.json`.

## 2 · Apply the schema

**Option A — SQL Editor (one paste)**

Open <https://supabase.com/dashboard/project/nnyokeivsnvbbxzfqexf/sql>, paste
all of `supabase/setup.sql` and run it. That file is the four migrations in
order **plus** the seed, so the menu arrives with it.

**Option B — CLI**

```bash
npm run db:push          # supabase link --project-ref nnyokeivsnvbbxzfqexf && db push
```

`db push` applies the migrations but not the seed on a hosted project — paste
`supabase/seed.sql` in the SQL Editor afterwards if you use this route.

Verify: **Table Editor** should show `products` with 17 rows, `categories` 5,
`reviews` 4 — or let the script tell you:

```bash
npm run db:check
```

It reads `frontend/.env`, checks the key's role and project ref, and reports
the row count of every table the site needs. If the tables are there but the
menu is empty, paste `supabase/seed-only.sql` — it fills the 5 categories, 17
dishes and 4 reviews and changes nothing structural.

Then generate the TypeScript types the frontend compiles against:

```bash
npm run db:types
```

## 3 · Deploy the Edge Functions

```bash
npm run functions:deploy     # create-order, razorpay, razorpay-webhook
```

`create-order` and `razorpay` require a signed-in user (JWT verified by the
gateway); `razorpay-webhook` is public but verifies Razorpay's HMAC.

### Secrets

```bash
npx supabase secrets set \
  RAZORPAY_KEY_ID=rzp_live_xxx \
  RAZORPAY_KEY_SECRET=xxx \
  RAZORPAY_WEBHOOK_SECRET=whsec_xxx \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="Khang <orders@yourdomain.com>" \
  ORDER_NOTIFY_EMAIL=sultham456@gmail.com
```

| Secret | Required? | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | for online payments | COD works without them |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | without it the webhook refuses every call |
| `RESEND_API_KEY` | for emails | orders still save without it |
| `EMAIL_FROM` | with Resend | must be a verified sender/domain |
| `ORDER_NOTIFY_EMAIL` | optional | defaults to sultham456@gmail.com |

## 4 · Razorpay

1. **Settings → API Keys → Generate** (test mode first).
2. Put the pair in the secrets above and redeploy the functions.
3. **Settings → Webhooks → Add**
   - URL: `https://<ref>.supabase.co/functions/v1/razorpay-webhook`
   - Events: `payment.captured`, `payment.failed`
   - Copy the **secret** into `RAZORPAY_WEBHOOK_SECRET`.
4. Test with card `4111 1111 1111 1111`, any future expiry, any CVV.

## 5 · Frontend on Vercel

1. Vercel → **Add New → Project** → import the GitHub repo.
2. **Root Directory:** `frontend`
3. Framework preset: **Vite** · build `npm run build` · output `dist`
4. Environment variables:

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

5. **Deploy**, then add the domain to Supabase **Authentication → URL
   Configuration → Site URL** (and redirect allow-list) so links and sessions
   behave.

`frontend/vercel.json` already sets the SPA rewrite and security headers, which
is what makes `/brand` (the brand-film page) resolve.

### Netlify alternative

- Base directory: `frontend`
- Build: `npm run build` · Publish: `frontend/dist`
- Env: the same two `VITE_SUPABASE_*` values
- SPA fallback: `frontend/public/_redirects` (`/*  /index.html  200`)

## 6 · Admins

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```

The key icon in the navbar then shows every order and lets you move one along
(`received → preparing → out_for_delivery → delivered`). Status changes append
to `order_tracking`.

## 7 · Backups & limits

| Plan | What you get |
|---|---|
| Supabase Free | 500 MB database, 2 GB bandwidth, functions on the free tier |
| Supabase Pro | daily backups + PITR, no project pausing |

Daily backups are on Pro; on Free, `pg_dump` from **Database → Connection
string** (or `supabase db dump`) is your backup:

```bash
npx supabase db dump -f khang-backup.sql
```

## 8 · Local development

```bash
# Supabase in Docker (optional, needs Docker)
npx supabase start
npx supabase db reset        # migrations + seed

# Frontend
cd frontend && npm run dev
```

If you only want to click through the UI, leave `VITE_SUPABASE_*` empty: the dev
build then talks to the bundled mock (`cd frontend && npm run mock` — port 5000,
proxied by Vite at `/api`). Production builds refuse to start without Supabase
rather than silently pointing at a mock.

## 9 · Post-deploy checklist

- [ ] `products` has 17 rows, `categories` 5, `reviews` 4
- [ ] Sign up works and creates a `profiles` row
- [ ] COD order lands in `orders` with 5% tax and ₹40 delivery
- [ ] Razorpay test payment marks the order `paid`
- [ ] Webhook shows `200` in **Edge Functions → Logs**
- [ ] Receipt + kitchen email arrive (check spam on the first send)
- [ ] Another account cannot open the order id you just placed
- [ ] `/brand` loads on the deployed domain
