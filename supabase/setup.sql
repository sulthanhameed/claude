-- ============================================================================
--  KHANG — one-paste database setup
--
--  Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
--  It is the four files in supabase/migrations/ in order, followed by
--  supabase/seed.sql, so a fresh project ends up with:
--
--    · 9 tables, 5 enums, indexes and triggers
--    · place_order / mark_order_paid / track_order / newsletter functions
--    · row level security on every table
--    · 5 categories, 17 dishes and 4 house reviews
--
--  Safe to run twice: tables use `if not exists`, functions `or replace`,
--  policies are dropped first, and the seed upserts on its natural keys.
--
--  Prefer the CLI? `supabase link --project-ref <ref> && supabase db push`
--  applies the migrations, and `supabase db reset` replays the seed locally.
--
--  This file is generated — the migrations remain the source of truth. After
--  editing them, rebuild it with:  npm run setup:sql
-- ============================================================================

-- ============================================================================
--  1 · SCHEMA — tables, enums, indexes, triggers
--  source: supabase/migrations/20261024090000_schema.sql
-- ============================================================================

-- ============================================================================
--  Khang Chinese Restaurant & Dimsum — schema
--
--  Postgres for Supabase: every list becomes a table, every fixed set becomes
--  a Postgres enum, and the two arrays an order used to carry (its lines and
--  its tracking events) become child tables that can be queried on their own.
--
--  Money is stored in whole rupees (integers), matching the menu and the UI.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('upi', 'card', 'wallet', 'cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_gateway as enum ('razorpay', 'cod', 'none');
exception when duplicate_object then null; end $$;

-- ── shared trigger ──────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per Supabase Auth user. Auth owns the credentials (email, password,
-- confirmation); this table owns the restaurant-specific fields.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  phone       text,
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Every new auth user gets a profile, with the name/phone they signed up with.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── categories ──────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon        text,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── products (the menu) ─────────────────────────────────────────────────────

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  chinese_name  text,
  category      text not null,
  price         integer not null check (price >= 0),
  description   text not null default '',
  ingredients   text[] not null default '{}',
  image         text not null default '',
  images        text[] not null default '{}',
  rating        numeric(2, 1) not null default 4.5 check (rating between 0 and 5),
  reviews_count integer not null default 0 check (reviews_count >= 0),
  spicy         integer not null default 0 check (spicy between 0 and 3),
  veg           boolean not null default true,
  featured      boolean not null default false,
  prep_time     text not null default '15 min',
  in_stock      boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_featured_idx on public.products (featured) where featured;
create index if not exists products_price_idx    on public.products (price);
create index if not exists products_search_idx   on public.products
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(chinese_name, '') || ' ' || coalesce(description, '')));

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ── reviews ─────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  -- null for imported/house reviews, which have no auth account behind them
  user_id    uuid references auth.users (id) on delete set null,
  product_id uuid references public.products (id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  body       text not null check (char_length(body) between 1 and 1000),
  user_name  text,
  location   text,
  verified   boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_idx on public.reviews (product_id);
create unique index if not exists reviews_one_per_user_product
  on public.reviews (user_id, product_id) where user_id is not null;

-- Keep products.rating / reviews_count in step with the review rows.
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = target), 4.5),
         reviews_count = (select count(*) from public.reviews r where r.product_id = target)
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ── the order counter (KH-YYYY-NNNN) ───────────────────────────────────────

create sequence if not exists public.order_number_seq start 1;

-- ── orders ──────────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        text not null unique,
  user_id         uuid not null references auth.users (id) on delete restrict,

  -- customer snapshot at order time
  customer_name   text,
  customer_phone  text,
  customer_email  text,

  -- delivery address snapshot
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  pincode         text,

  -- pricing, always recalculated by the kitchen, never trusted from the browser
  subtotal        integer not null check (subtotal >= 0),
  tax             integer not null check (tax >= 0),
  delivery        integer not null default 0 check (delivery >= 0),
  discount        integer not null default 0 check (discount >= 0),
  total           integer not null check (total >= 0),

  -- payment
  payment_method     public.payment_method not null,
  payment_gateway    public.payment_gateway not null default 'none',
  payment_status     public.payment_status not null default 'pending',
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  paid_at         timestamptz,
  refunded_at     timestamptz,
  refund_id       text,

  -- fulfilment
  status             public.order_status not null default 'received',
  estimated_delivery timestamptz,
  delivered_at       timestamptz,

  -- email flags, so retries never send twice
  customer_email_sent_at timestamptz,
  owner_email_sent_at    timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx    on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx  on public.orders (status);
create index if not exists orders_payment_idx on public.orders (payment_status);
create index if not exists orders_email_idx   on public.orders (customer_email);
create index if not exists orders_created_idx on public.orders (created_at desc);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  name         text not null,
  chinese_name text,
  image        text,
  price        integer not null check (price >= 0),
  qty          integer not null check (qty between 1 and 20),
  position     integer not null default 0
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_tracking (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  stage    public.order_status not null,
  note     text,
  at       timestamptz not null default now()
);

create index if not exists order_tracking_order_idx on public.order_tracking (order_id, at);

-- ── newsletter ──────────────────────────────────────────────────────────────

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  source          text not null default 'footer',
  active          boolean not null default true,
  subscribed_at   timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================================
--  2 · FUNCTIONS — pricing, orders, tracking, newsletter
--  source: supabase/migrations/20261024090100_functions.sql
-- ============================================================================

-- ============================================================================
--  Khang — functions the API used to own
--
--  Pricing, order numbering, tracking and newsletter signup all happen here,
--  in Postgres, so the browser can never send its own total. The Edge
--  Functions in /supabase/functions are thin HTTP wrappers around these.
-- ============================================================================

-- ── is the caller an admin? ─────────────────────────────────────────────────
-- SECURITY DEFINER so it can read profiles without tripping RLS (and without
-- recursing, which a policy on profiles would otherwise do).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ── one canonical order payload ─────────────────────────────────────────────
-- The shape the frontend's KhangOrder expects (camelCase), built from the
-- normalised tables. Every function below returns this.

create or replace function public.order_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    '_id', o.id,
    'orderId', o.order_id,
    'user', o.user_id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product', i.product_id,
        'name', i.name,
        'chineseName', i.chinese_name,
        'image', i.image,
        'price', i.price,
        'qty', i.qty
      ) order by i.position)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'customer', jsonb_build_object(
      'name', o.customer_name,
      'phone', o.customer_phone,
      'email', o.customer_email
    ),
    'address', jsonb_build_object(
      'line1', o.address_line1,
      'line2', o.address_line2,
      'city', o.city,
      'state', o.state,
      'pincode', o.pincode
    ),
    'subtotal', o.subtotal,
    'tax', o.tax,
    'delivery', o.delivery,
    'discount', o.discount,
    'total', o.total,
    'payment', jsonb_build_object(
      'method', o.payment_method,
      'gateway', o.payment_gateway,
      'status', o.payment_status,
      'razorpayOrderId', o.razorpay_order_id,
      'paidAt', o.paid_at
    ),
    'status', o.status,
    'tracking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stage', t.stage, 'note', t.note, 'at', t.at
      ) order by t.at)
      from public.order_tracking t where t.order_id = o.id
    ), '[]'::jsonb),
    'estimatedDelivery', o.estimated_delivery,
    'deliveredAt', o.delivered_at,
    'createdAt', o.created_at
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- ── place_order ─────────────────────────────────────────────────────────────
-- Called by the create-order Edge Function with the verified user id.
-- Prices, tax (5 %) and delivery (₹40, free over ₹500) are all decided here.

create or replace function public.place_order(
  p_user           uuid,
  p_items          jsonb,
  p_customer       jsonb,
  p_address        jsonb,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item          jsonb;
  v_product       public.products;
  v_qty           integer;
  v_count         integer := 0;
  v_subtotal      integer := 0;
  v_tax           integer := 0;
  v_delivery      integer := 0;
  v_total         integer := 0;
  v_order_number  integer;
  v_order_id      text;
  v_order_pk      uuid;
  v_position      integer := 0;
  v_customer_name text;
  v_customer_phone text;
  v_customer_email text;
begin
  if p_user is null then
    raise exception 'Please sign in to place an order' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) > 20 then
    raise exception 'Too many different items in one order' using errcode = 'P0001';
  end if;

  if p_payment_method not in ('upi', 'card', 'wallet', 'cod') then
    raise exception 'Invalid payment method' using errcode = 'P0001';
  end if;

  v_customer_name  := nullif(btrim(p_customer ->> 'name'), '');
  v_customer_phone := nullif(btrim(p_customer ->> 'phone'), '');
  v_customer_email := nullif(btrim(p_customer ->> 'email'), '');

  if v_customer_phone is null then
    raise exception 'Phone number is required' using errcode = 'P0001';
  end if;

  if p_address is null or nullif(btrim(p_address ->> 'line1'), '') is null then
    raise exception 'Delivery address is required' using errcode = 'P0001';
  end if;

  -- first pass: price the cart against the live menu
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'qty')::integer, 0);
    if v_qty < 1 or v_qty > 20 then
      raise exception 'Quantity must be between 1 and 20' using errcode = 'P0001';
    end if;

    select * into v_product
      from public.products
     where id = (v_item ->> 'product')::uuid;

    if not found then
      raise exception 'A dish in your cart is no longer available' using errcode = 'P0001';
    end if;

    if v_product.in_stock is false then
      raise exception '% is currently sold out', v_product.name using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_count := v_count + 1;
  end loop;

  v_tax := round(v_subtotal * 0.05)::integer;
  v_delivery := case when v_subtotal > 500 then 0 else 40 end;
  v_total := v_subtotal + v_tax + v_delivery;

  v_order_number := nextval('public.order_number_seq');
  v_order_id := 'KH-' || to_char(now(), 'YYYY') || '-' || lpad(v_order_number::text, 4, '0');

  insert into public.orders (
    order_id, user_id, customer_name, customer_phone, customer_email,
    address_line1, address_line2, city, state, pincode,
    subtotal, tax, delivery, total,
    payment_method, payment_gateway, payment_status,
    status, estimated_delivery
  )
  values (
    v_order_id, p_user, v_customer_name, v_customer_phone, v_customer_email,
    btrim(p_address ->> 'line1'),
    nullif(btrim(coalesce(p_address ->> 'line2', '')), ''),
    nullif(btrim(coalesce(p_address ->> 'city', '')), ''),
    nullif(btrim(coalesce(p_address ->> 'state', '')), ''),
    nullif(btrim(coalesce(p_address ->> 'pincode', '')), ''),
    v_subtotal, v_tax, v_delivery, v_total,
    p_payment_method::public.payment_method,
    case when p_payment_method = 'cod' then 'cod' else 'razorpay' end::public.payment_gateway,
    'pending'::public.payment_status,
    'received'::public.order_status,
    now() + interval '35 minutes'
  )
  returning id into v_order_pk;

  -- second pass: write the lines exactly as they were priced
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item ->> 'product')::uuid;
    v_qty := (v_item ->> 'qty')::integer;

    insert into public.order_items (
      order_id, product_id, name, chinese_name, image, price, qty, position
    )
    values (
      v_order_pk, v_product.id, v_product.name, v_product.chinese_name,
      v_product.image, v_product.price, v_qty, v_position
    );

    v_position := v_position + 1;
  end loop;

  insert into public.order_tracking (order_id, stage, note)
  values (v_order_pk, 'received', 'Order placed');

  return public.order_payload(v_order_pk);
end;
$$;

revoke all on function public.place_order(uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, jsonb, jsonb, jsonb, text) to service_role;

-- ── mark_order_paid ─────────────────────────────────────────────────────────
-- Called by the razorpay Edge Function only after the HMAC signature checked
-- out. Idempotent: a retried verification returns the same order untouched.

create or replace function public.mark_order_paid(
  p_order_id          text,
  p_razorpay_order_id text,
  p_payment_id        text,
  p_signature         text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      public.orders;
  v_newly_paid boolean := false;
begin
  select * into v_order from public.orders where order_id = p_order_id for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  if v_order.payment_status <> 'paid' then
    update public.orders
       set payment_status = 'paid',
           payment_gateway = 'razorpay',
           razorpay_order_id = coalesce(p_razorpay_order_id, razorpay_order_id),
           razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
           razorpay_signature = coalesce(p_signature, razorpay_signature),
           paid_at = now()
     where id = v_order.id;

    v_newly_paid := true;
  end if;

  return jsonb_build_object(
    'order', public.order_payload(v_order.id),
    'newlyPaid', v_newly_paid
  );
end;
$$;

revoke all on function public.mark_order_paid(text, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, text, text) to service_role;

-- ── email bookkeeping ───────────────────────────────────────────────────────

create or replace function public.mark_order_emailed(
  p_order_id uuid,
  p_audience text   -- 'customer' | 'owner'
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
     set customer_email_sent_at = case when p_audience = 'customer' then now() else customer_email_sent_at end,
         owner_email_sent_at    = case when p_audience = 'owner'    then now() else owner_email_sent_at end
   where id = p_order_id;
$$;

revoke all on function public.mark_order_emailed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_order_emailed(uuid, text) to service_role;

-- ── public order tracking ───────────────────────────────────────────────────
-- Anyone with the order id can follow it — but only the fields a courier
-- would show. No address, no email, no payment ids.

create or replace function public.track_order(p_order_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payload jsonb;
begin
  select * into v_order
    from public.orders
   where order_id = upper(btrim(p_order_id));

  if not found then
    raise exception 'No order found with that ID' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'orderId', v_order.order_id,
    'status', v_order.status,
    'total', v_order.total,
    'estimatedDelivery', v_order.estimated_delivery,
    'deliveredAt', v_order.delivered_at,
    'createdAt', v_order.created_at,
    'customer', jsonb_build_object('name', v_order.customer_name),
    'payment', jsonb_build_object('method', v_order.payment_method, 'status', v_order.payment_status),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty) order by i.position)
      from public.order_items i where i.order_id = v_order.id
    ), '[]'::jsonb),
    'tracking', coalesce((
      select jsonb_agg(jsonb_build_object('stage', t.stage, 'note', t.note, 'at', t.at) order by t.at)
      from public.order_tracking t where t.order_id = v_order.id
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated, service_role;

-- ── admin: move an order along ──────────────────────────────────────────────

create or replace function public.admin_set_order_status(
  p_order   uuid,
  p_status  text,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if p_status is null
     or p_status not in ('received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'Unknown status' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order;
  if not found then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_status::public.order_status,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_order;

  insert into public.order_tracking (order_id, stage, note)
  values (p_order, p_status::public.order_status, p_note);

  return public.order_payload(p_order);
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated, service_role;

-- ── newsletter ──────────────────────────────────────────────────────────────

create or replace function public.subscribe_newsletter(p_email text, p_source text default 'footer')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(btrim(p_email));
  v_existed boolean;
begin
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'A valid email is required' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.newsletter_subscribers where email = v_email) into v_existed;

  insert into public.newsletter_subscribers (email, source)
  values (v_email, coalesce(nullif(btrim(p_source), ''), 'footer'))
  on conflict (email) do update set active = true, unsubscribed_at = null;

  return jsonb_build_object(
    'message', case
      when v_existed then 'You are already on the list — the 10% code is in your inbox.'
      else 'You are on the list. Watch out for chef''s specials.'
    end,
    'subscriber', jsonb_build_object('email', v_email),
    'alreadySubscribed', v_existed
  );
end;
$$;

revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated, service_role;

-- ── mark_order_refunded ─────────────────────────────────────────────────────
-- Called by the razorpay Edge Function after a refund has been accepted by
-- Razorpay (admin-initiated).

create or replace function public.mark_order_refunded(
  p_order_id text,
  p_refund_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where order_id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  update public.orders
     set payment_status = 'refunded',
         refund_id = coalesce(p_refund_id, refund_id),
         refunded_at = now()
   where id = v_order.id;

  return public.order_payload(v_order.id);
end;
$$;

revoke all on function public.mark_order_refunded(text, text) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(text, text) to service_role;

-- ── mark_order_failed ───────────────────────────────────────────────────────
-- A Razorpay payment.failed webhook lands here. A later success is still
-- allowed: mark_order_paid() only refuses to run when the order is already paid.

create or replace function public.mark_order_failed(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where order_id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  if v_order.payment_status = 'pending' then
    update public.orders set payment_status = 'failed' where id = v_order.id;
  end if;

  return public.order_payload(v_order.id);
end;
$$;

revoke all on function public.mark_order_failed(text) from public, anon, authenticated;
grant execute on function public.mark_order_failed(text) to service_role;

-- ============================================================================
--  3 · ROW LEVEL SECURITY
--  source: supabase/migrations/20261024090200_rls.sql
-- ============================================================================

-- ============================================================================
--  Khang — row level security
--
--  The menu is public. A customer sees their own orders and nothing else.
--  Admins see every order. Writes to orders only happen through the
--  SECURITY DEFINER functions, so the browser can never invent a price.
-- ============================================================================

-- order_payload returns a full order (address, email, payment ids): keep it
-- for the definer functions only.
revoke all on function public.order_payload(uuid) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.reviews               enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_tracking        enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Role changes are deliberately not allowed from the client: even a full-row
-- update keeps the existing role, because the check below re-reads it.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── menu: readable by everyone, writable by admins ──────────────────────────

drop policy if exists "menu is public" on public.categories;
create policy "menu is public" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "categories are admin-writable" on public.categories;
create policy "categories are admin-writable" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "menu is public" on public.products;
create policy "menu is public" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "products are admin-writable" on public.products;
create policy "products are admin-writable" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── reviews ─────────────────────────────────────────────────────────────────

drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews
  for select to anon, authenticated using (true);

drop policy if exists "guests can write their own review" on public.reviews;
create policy "guests can write their own review" on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "own review can be edited" on public.reviews;
create policy "own review can be edited" on public.reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own review can be deleted" on public.reviews;
create policy "own review can be deleted" on public.reviews
  for delete to authenticated using (user_id = auth.uid());

-- ── orders ──────────────────────────────────────────────────────────────────

drop policy if exists "own orders are visible" on public.orders;
create policy "own orders are visible" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own order lines are visible" on public.order_items;
create policy "own order lines are visible" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_items.order_id
       and (o.user_id = auth.uid() or public.is_admin())
  ));

drop policy if exists "own tracking is visible" on public.order_tracking;
create policy "own tracking is visible" on public.order_tracking
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_tracking.order_id
       and (o.user_id = auth.uid() or public.is_admin())
  ));

-- No insert/update/delete policies on orders at all: creating an order goes
-- through place_order(), paying it through mark_order_paid(), and moving it
-- along through admin_set_order_status(). All three are SECURITY DEFINER.

-- ── newsletter ──────────────────────────────────────────────────────────────
-- No policies on purpose: the table is reachable only through
-- subscribe_newsletter(), so the list cannot be read from the browser.

-- ============================================================================
--  4 · ORDER READS — my_orders, get_my_order, admin list
--  source: supabase/migrations/20261024090300_order_reads.sql
-- ============================================================================

-- ============================================================================
--  Khang — reading orders
--
--  Orders are read through functions rather than `select *`: the RPC returns
--  the same camelCase payload the Edge Functions produce, and each function
--  decides for itself who is allowed to see the row. Nothing here can be
--  coaxed into returning somebody else's address.
-- ============================================================================

-- A customer's own orders, newest first.
create or replace function public.my_orders()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.order_payload(o.id)
    from public.orders o
   where o.user_id = auth.uid()
   order by o.created_at desc;
$$;

revoke all on function public.my_orders() from public, anon;
grant execute on function public.my_orders() to authenticated, service_role;

-- One order, if it is mine (or if I am an admin).
create or replace function public.get_my_order(p_order_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order
    from public.orders
   where order_id = btrim(p_order_id);

  if not found then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  -- `is distinct from` also stops a row with no owner leaking to anyone
  if v_order.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;

  return public.order_payload(v_order.id);
end;
$$;

revoke all on function public.get_my_order(text) from public, anon;
grant execute on function public.get_my_order(text) to authenticated, service_role;

-- The kitchen's list. Admins only.
create or replace function public.admin_list_orders(p_status text default null)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
    select public.order_payload(o.id)
      from public.orders o
     where p_status is null or o.status = p_status::public.order_status
     order by o.created_at desc;
end;
$$;

revoke all on function public.admin_list_orders(text) from public, anon;
grant execute on function public.admin_list_orders(text) to authenticated, service_role;

-- ============================================================================
--  5 · SEED — 5 categories, 17 dishes, 4 house reviews
--  source: supabase/seed.sql
-- ============================================================================

-- Khang — seed data
--
-- The menu the site ships with: 5 categories, 17 dishes, and the four
-- house reviews shown on the home page. Safe to re-run — every insert is
-- keyed on its natural key.

-- ── categories ──────────────────────────────────────────────────────────

insert into public.categories (name, slug, icon, sort_order) values
  ('Dim Sum', 'dim-sum', '🥟', 1),
  ('Noodles & Soups', 'noodles-soups', '🍜', 2),
  ('Rice & Curry', 'rice-curry', '🍛', 3),
  ('Snacks', 'snacks', '🍟', 4),
  ('Drinks', 'drinks', '🥤', 5)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

-- ── the menu ────────────────────────────────────────────────────────────

insert into public.products (
  slug, name, chinese_name, category, price, description, ingredients,
  image, rating, reviews_count, spicy, veg, featured, prep_time, in_stock
) values
  ('khang-special-veg-momo', 'Khang Special Veg Momo', '康式素饺', 'Dim Sum', 180, 'Hand-folded steamed dumplings stuffed with cabbage, carrot, bell pepper and a hint of ginger-garlic. Served with our signature schezwan dip.', array['Refined flour', 'Cabbage', 'Carrot', 'Spring onion', 'Ginger', 'Garlic', 'Sesame oil']::text[], 'https://images.pexels.com/photos/35144940/pexels-photo-35144940.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.8, 412, 1, true, true, '15 min', true),
  ('chicken-dimsum-basket', 'Chicken Dimsum Basket', '鸡肉点心', 'Dim Sum', 240, 'Delicate translucent wrappers cradling minced chicken seasoned with soy, sesame, and a touch of white pepper. Steamed in bamboo baskets.', array['Chicken mince', 'Wheat starch', 'Soy', 'Sesame', 'Coriander', 'White pepper']::text[], 'https://images.pexels.com/photos/32393812/pexels-photo-32393812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.9, 587, 1, false, true, '18 min', true),
  ('pan-fried-chicken-momo', 'Pan-Fried Chicken Momo', '煎鸡饺', 'Dim Sum', 260, 'Steamed first, then pan-seared to golden perfection. Crisp base, juicy chicken filling, served with chilli-garlic oil.', array['Chicken', 'Garlic', 'Soy', 'Chilli oil', 'Spring onion']::text[], 'https://images.pexels.com/photos/14457519/pexels-photo-14457519.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 318, 2, false, true, '20 min', true),
  ('crystal-prawn-hargao', 'Crystal Prawn Hargao', '虾饺', 'Dim Sum', 320, 'Cantonese classic — succulent prawn wrapped in glass-thin wheat starch skins. Each piece pleated by hand.', array['Prawn', 'Bamboo shoot', 'Wheat starch', 'Tapioca', 'Sesame oil']::text[], 'https://images.pexels.com/photos/27039841/pexels-photo-27039841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.9, 246, 0, false, true, '22 min', true),
  ('hakka-chow-mein', 'Hakka Chow Mein', '客家炒面', 'Noodles & Soups', 220, 'Smoky wok-tossed noodles with crunchy julienned vegetables in a savoury soy & sesame glaze. The wok-hei is real.', array['Hakka noodles', 'Cabbage', 'Capsicum', 'Carrot', 'Soy', 'Sesame']::text[], 'https://images.pexels.com/photos/14853728/pexels-photo-14853728.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 521, 1, true, true, '12 min', true),
  ('schezwan-chicken-noodles', 'Schezwan Chicken Noodles', '川味鸡肉面', 'Noodles & Soups', 280, 'Fiery Schezwan-style noodles tossed with shredded chicken, bell peppers and our house chilli-bean paste.', array['Noodles', 'Chicken', 'Schezwan sauce', 'Capsicum', 'Garlic']::text[], 'https://images.pexels.com/photos/12737657/pexels-photo-12737657.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 389, 3, false, false, '14 min', true),
  ('hot-sour-soup', 'Hot & Sour Soup', '酸辣汤', 'Noodles & Soups', 160, 'The original — black pepper, vinegar, mushrooms, tofu and silken egg ribbons in a velvety broth.', array['Vegetable stock', 'Tofu', 'Mushroom', 'Egg', 'Vinegar', 'Pepper']::text[], 'https://images.pexels.com/photos/18698263/pexels-photo-18698263.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.5, 284, 2, true, false, '10 min', true),
  ('sweet-corn-chicken-soup', 'Sweet Corn Chicken Soup', '玉米鸡汤', 'Noodles & Soups', 170, 'Comfort in a bowl — silky corn soup with shredded chicken and a swirl of egg.', array['Sweet corn', 'Chicken', 'Egg', 'Cornflour', 'Pepper']::text[], 'https://images.pexels.com/photos/10966377/pexels-photo-10966377.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.4, 192, 0, false, false, '10 min', true),
  ('veg-triple-schezwan-rice', 'Veg Triple Schezwan Rice', '三重川味饭', 'Rice & Curry', 260, 'Layered tower of fried rice, hakka noodles and Schezwan gravy crowned with crispy veggies. A meal in itself.', array['Basmati rice', 'Noodles', 'Schezwan gravy', 'Mixed veg']::text[], 'https://images.pexels.com/photos/24334865/pexels-photo-24334865.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 433, 2, true, true, '16 min', true),
  ('chicken-fried-rice', 'Chicken Fried Rice', '鸡肉炒饭', 'Rice & Curry', 240, 'Long-grain rice tossed with chicken, egg, spring onion and a kiss of dark soy. Simple, smoky, perfect.', array['Basmati rice', 'Chicken', 'Egg', 'Spring onion', 'Soy']::text[], 'https://images.pexels.com/photos/343871/pexels-photo-343871.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 367, 1, false, false, '12 min', true),
  ('chilli-chicken-gravy', 'Chilli Chicken Gravy', '辣子鸡', 'Rice & Curry', 290, 'Crispy chicken bites in a glossy, fiery sauce of green chilli, garlic and soy. Best with steamed rice.', array['Chicken', 'Green chilli', 'Garlic', 'Soy', 'Vinegar', 'Capsicum']::text[], 'https://images.pexels.com/photos/29631426/pexels-photo-29631426.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.8, 511, 3, false, true, '15 min', true),
  ('veg-manchurian-dry', 'Veg Manchurian Dry', '素满洲', 'Rice & Curry', 220, 'Golden-fried vegetable balls tossed in a tangy Indo-Chinese sauce with ginger, garlic and spring onion.', array['Mixed vegetables', 'Cornflour', 'Soy', 'Ginger', 'Garlic']::text[], 'https://images.pexels.com/photos/28674543/pexels-photo-28674543.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 298, 2, true, false, '14 min', true),
  ('crispy-veg-spring-rolls', 'Crispy Veg Spring Rolls', '春卷', 'Snacks', 160, 'Paper-thin wrappers around a julienne of cabbage, carrot and noodles — fried until shatter-crisp.', array['Spring roll sheets', 'Cabbage', 'Carrot', 'Noodles', 'Soy']::text[], 'https://images.pexels.com/photos/37106473/pexels-photo-37106473.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.5, 276, 1, true, false, '10 min', true),
  ('chilli-paneer-dry', 'Chilli Paneer Dry', '辣椒奶酪', 'Snacks', 250, 'Cubes of soft paneer wok-tossed with bell peppers, soy, and green chilli — a vegetarian crowd-pleaser.', array['Paneer', 'Bell pepper', 'Soy', 'Green chilli', 'Garlic']::text[], 'https://images.pexels.com/photos/29631468/pexels-photo-29631468.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 341, 2, true, false, '12 min', true),
  ('honey-chilli-potato', 'Honey Chilli Potato', '蜜辣土豆', 'Snacks', 180, 'Twice-fried potato strips glazed in honey, chilli and sesame. Sticky, sweet, spicy — all at once.', array['Potato', 'Honey', 'Red chilli', 'Sesame seeds', 'Soy']::text[], 'https://images.pexels.com/photos/30709506/pexels-photo-30709506.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 412, 2, true, false, '12 min', true),
  ('jasmine-green-tea', 'Jasmine Green Tea', '茉莉绿茶', 'Drinks', 90, 'Hand-rolled jasmine pearls steeped to release a floral, calming aroma. The traditional accompaniment to dim sum.', array['Jasmine green tea leaves', 'Hot water']::text[], 'https://images.pexels.com/photos/36299339/pexels-photo-36299339.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.6, 156, 0, true, false, '5 min', true),
  ('lychee-iced-cooler', 'Lychee Iced Cooler', '荔枝冰饮', 'Drinks', 140, 'Sweet lychee pulp shaken with lime, mint and crushed ice. A summer favourite.', array['Lychee', 'Lime', 'Mint', 'Sugar syrup', 'Ice']::text[], 'https://images.pexels.com/photos/37659704/pexels-photo-37659704.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.5, 198, 0, true, false, '5 min', true)
on conflict (slug) do update set
  name = excluded.name,
  chinese_name = excluded.chinese_name,
  category = excluded.category,
  price = excluded.price,
  description = excluded.description,
  ingredients = excluded.ingredients,
  image = excluded.image,
  spicy = excluded.spicy,
  veg = excluded.veg,
  featured = excluded.featured,
  prep_time = excluded.prep_time;

-- ── house reviews ───────────────────────────────────────────────────────

insert into public.reviews (product_id, rating, body, user_name, location, verified)
select p.id, v.rating, v.body, v.user_name, v.location, true
  from (values
    ('khang-special-veg-momo', 5, 'The momos are the best I have had outside of Kolkata. Steamed perfectly, and that schezwan dip is dangerous.', 'Ananya R.', 'Madurai'),
    ('chicken-dimsum-basket', 5, 'Ordered for a small birthday dinner — everything arrived hot, and the hargao looked hand-pleated. Lovely.', 'Vikram S.', 'Chennai'),
    ('crystal-prawn-hargao', 4, 'Solid dim sum and generous portions. Delivery took a little longer than promised but the food was worth it.', 'Meera K.', 'Madurai'),
    ('chilli-chicken-gravy', 5, 'The chilli chicken gravy with steamed rice is my weekly order now. Proper heat, not just colour.', 'Rahul D.', 'Coimbatore')
  ) as v(slug, rating, body, user_name, location)
  join public.products p on p.slug = v.slug
 where not exists (
    select 1 from public.reviews r
     where r.product_id = p.id and r.user_name = v.user_name
  );

-- The rating trigger fires while the house reviews are inserted, so put the
-- curated totals back on those four dishes. Customer reviews written later keep
-- updating them from real rows.
update public.products p
   set rating = v.rating, reviews_count = v.total
  from (values
    ('khang-special-veg-momo', 4.8, 412),
    ('chicken-dimsum-basket', 4.9, 587),
    ('crystal-prawn-hargao', 4.9, 246),
    ('chilli-chicken-gravy', 4.8, 511)
  ) as v(slug, rating, total)
 where p.slug = v.slug;

-- ── the newsletter list starts empty ────────────────────────────────────
-- (subscribers arrive through subscribe_newsletter())

-- ── make yourself an admin ──────────────────────────────────────────────
-- Sign up in the app first, then run:
--   update public.profiles set role = 'admin' where id = (
--     select id from auth.users where email = 'you@example.com');
