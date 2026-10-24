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

## 1 · Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**
   - Region: **Mumbai (ap-south-1)** for Indian customers, or Singapore.
   - Save the database password somewhere safe.
2. **Project Settings → API** → copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. **Authentication → Providers → Email** — for a smooth demo, turn
   **Confirm email** off. Leave it on for production; the app then tells the
   guest to confirm before signing in.

## 2 · Apply the schema

**Option A — CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

**Option B — SQL Editor**

Run these files, in this order:

1. `supabase/migrations/20261024090000_schema.sql`
2. `supabase/migrations/20261024090100_functions.sql`
3. `supabase/migrations/20261024090200_rls.sql`
4. `supabase/migrations/20261024090300_order_reads.sql`
5. `supabase/seed.sql`

Verify: **Table Editor** should show `products` with 17 rows, `categories` 5,
`reviews` 4.

## 3 · Deploy the Edge Functions

```bash
npx supabase functions deploy create-order
npx supabase functions deploy razorpay
npx supabase functions deploy razorpay-webhook
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
