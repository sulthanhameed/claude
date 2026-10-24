-- ============================================================================
--  Khang Chinese Restaurant & Dimsum — schema
--
--  Postgres for Supabase. This replaces the old MongoDB/Mongoose models:
--  every collection becomes a table, every enum becomes a Postgres type, and
--  the document arrays (order items, tracking events) become child tables.
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
