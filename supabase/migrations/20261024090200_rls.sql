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
