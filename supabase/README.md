# Khang — Supabase backend

The restaurant runs on Supabase: **Postgres** for the data, **Supabase Auth**
for accounts, and three **Edge Functions** for the operations that must not
happen in a browser (pricing + email, Razorpay, and the payment webhook).

There is no separate application server to deploy, keep awake or scale by
hand: the database, the accounts and the server-side logic are one service.

```
supabase/
├── migrations/
│   ├── 20261024090000_schema.sql      tables, enums, indexes, triggers
│   ├── 20261024090100_functions.sql   place_order, mark_order_paid, tracking…
│   ├── 20261024090200_rls.sql         row level security
│   └── 20261024090300_order_reads.sql my_orders, get_my_order, admin list
├── seed.sql                          5 categories, 17 dishes, 4 reviews
├── setup.sql                         all of the above, in one paste (generated)
├── functions/
│   ├── create-order/                  cart → order (+ confirmation emails)
│   ├── razorpay/                      create + verify a payment, refunds
│   ├── razorpay-webhook/              payment.captured / payment.failed
│   └── _shared/                       cors, service-role client, email
└── config.toml
```

## The project

| | |
|---|---|
| Project ref | `jrfmgqccicrpdtqztrpt` |
| API URL | `https://jrfmgqccicrpdtqztrpt.supabase.co` |
| [Overview](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt) · [Table editor](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/editor) · [SQL editor](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/sql) | [Database](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/database/schemas) · [Auth](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/auth/users) · [Functions](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/functions) · [Advisors](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/advisors/security) |

### 1a. Put the database in it — paste route

1. Open the [SQL editor](https://supabase.com/dashboard/project/jrfmgqccicrpdtqztrpt/sql)
   → **New query**.
2. Paste **all of [`setup.sql`](./setup.sql)** → **Run**.

That is the four migrations plus the seed in one file: 9 tables, the order
functions, RLS everywhere, then 5 categories / 17 dishes / 4 reviews. Check
**Table editor** — `products` should say 17 rows. Re-running it is safe.

### 1b. Put the database in it — CLI route

```bash
npm run db:push          # supabase link --project-ref jrfmgqccicrpdtqztrpt && supabase db push
```

`db:push` links this project and applies `migrations/` in order. The seed is
not part of `db push` on a hosted project — either use the paste route above,
or run `supabase db reset` against the local stack.

### 1c. Point the frontend at it

**Project Settings → API** → copy the **anon public** key into
`frontend/.env`:

```env
VITE_SUPABASE_URL=https://jrfmgqccicrpdtqztrpt.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The key is meant for browsers: every table is protected by RLS and the writes
that touch money run inside `SECURITY DEFINER` functions. The **service_role**
key never leaves the Edge Functions.

### 1d. Deploy the Edge Functions

```bash
npm run functions:deploy     # create-order, razorpay, razorpay-webhook
```

### 1d‑bis. Direct database access

Anything that speaks Postgres — `psql`, DBeaver, a script, an ORM — can use the
connection string from **Project Settings → Database → Connection string**
(use the **pooler**, port 6543, for serverless clients):

```
postgresql://postgres.jrfmgqccicrpdtqztrpt:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

The password is the one set when the project was created. Tables live in
`public`; `auth.users` is Supabase's own and is linked from `public.profiles`.

### 1d‑ter. Typed queries (the "ORM")

`frontend/src/lib/database.types.ts` describes every table, enum and RPC, and
`createClient<Database>()` uses it, so `from("products").eq("category", …)` or
`rpc("place_order", { … })` is checked at compile time. Regenerate it whenever
the schema changes:

```bash
npm run db:types        # supabase gen types typescript --project-id jrfmgqccicrpdtqztrpt
```

### 1e. MCP (optional, for AI assistants)

The repo ships a project-scoped [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp)
server in `.mcp.json`, so an assistant can query this project's schema, logs and
SQL directly:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=jrfmgqccicrpdtqztrpt"
    }
  }
}
```

Claude Code picks that file up and authenticates through the browser on first
use (`/mcp` → supabase → login). Cursor: the same JSON in `.cursor/mcp.json`.
Scope it further with `&read_only=true` if you only want it to answer questions.

---

## 1. Create a project from scratch

Already done for this repo — the section above is the shortcut. For a fork:

1. <https://supabase.com/dashboard> → **New project** (region: Mumbai / Singapore).
2. **Project Settings → API** — copy the **Project URL** and the **anon public** key.
3. Put them in `frontend/.env`:

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Then push the database: `npm run setup:sql` after any migration edit, paste
`setup.sql`, or `supabase link --project-ref <ref> && supabase db push`.

## 2. Push the database

```bash
npm run db:push             # supabase link --project-ref jrfmgqccicrpdtqztrpt && supabase db push
```

…or paste `setup.sql` into the **SQL Editor** — same thing, seed included.

Locally, `supabase start && npm run db:reset` builds the whole thing from
scratch (migrations + seed) on your machine.

## 3. Deploy the Edge Functions

```bash
npm run functions:deploy    # create-order, razorpay, razorpay-webhook
```

`config.toml` already carries the per-function JWT setting: the first two
require a signed-in user, the webhook is public (Razorpay's HMAC is the proof).

Secrets (`supabase secrets set …`, or copy `functions/.env.example` to
`functions/.env` for `supabase functions serve`):

| secret | what it is |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay key id (test or live) |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret — server only |
| `RAZORPAY_WEBHOOK_SECRET` | webhook signing secret; without it the webhook refuses every call |
| `RESEND_API_KEY` | Resend API key for order emails (optional) |
| `EMAIL_FROM` | e.g. `Khang <orders@yourdomain.com>` (optional) |
| `ORDER_NOTIFY_EMAIL` | defaults to **sultham456@gmail.com** |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform; you never set those yourself.

Without `RESEND_API_KEY` orders still work — the function logs
`[email] skipped` instead of sending.

## 4. Make yourself an admin

Sign up in the app, then in the SQL Editor:

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```

The admin dashboard (the little key icon in the navbar) then lists every order
and can move one along; everyone else only ever sees their own.

## How an order happens

```
browser                       supabase                         razorpay
  │  invoke create-order ───────▶ edge fn
  │                               ├─ place_order()  ← prices from products
  │                               ├─ KH-2026-0001 from a sequence
  │                               └─ emails (COD only)
  │  ◀─────────────────────────── order
  │  invoke razorpay(create) ───▶ edge fn ── POST /v1/orders ──▶ key secret stays here
  │  ◀─────────────────────────── razorpay order id, key id, amount
  │  Checkout popup ───────────────────────────────────────────▶ payment
  │  invoke razorpay(verify) ───▶ edge fn
  │                               ├─ HMAC-SHA256 signature check
  │                               ├─ mark_order_paid()
  │                               └─ emails (idempotent)
  │  ◀─────────────────────────── verified
```

Totals are never accepted from the browser: `place_order()` re-prices the cart
from `products`, applies 5 % tax and ₹40 delivery (free over ₹500), and writes
the order and its lines in one transaction.

## Row level security in one table

| table | who can read | who can write |
|---|---|---|
| `products`, `categories` | everyone | admins |
| `reviews` | everyone | the author (insert/update/delete) |
| `profiles` | you, and admins | you (role changes are ignored) |
| `orders`, `order_items`, `order_tracking` | you, and admins | nobody directly — only the SQL functions |
| `newsletter_subscribers` | nobody | nobody directly — only `subscribe_newsletter()` |

## Realtime (optional)

Supabase can push order updates to an open tracking panel for free:

```sql
alter publication supabase_realtime add table public.order_tracking;
```

then subscribe to `order_tracking` filtered by `order_id` in the frontend. The
site currently polls on demand instead, which is enough for a 35-minute
delivery window.

## Checking your work

The frontend has one command for both of its checks:

```bash
cd frontend && npm run check      # tsc --noEmit, then a production build
```

The Edge Functions are Deno, so they are checked with Deno rather than with the
frontend's `tsconfig.json`:

```bash
deno check supabase/functions/create-order/index.ts \
           supabase/functions/razorpay/index.ts \
           supabase/functions/razorpay-webhook/index.ts
```

They import supabase-js through an `npm:` specifier, which the Deno language
server resolves on its own. To get editor completion and no phantom errors in
VS Code, install the **Deno** extension — the repo's `.vscode/settings.json`
already enables it for `supabase/functions` only, so the browser code keeps
using the normal TypeScript service.
