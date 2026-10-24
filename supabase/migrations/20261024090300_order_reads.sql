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

  if v_order.user_id <> auth.uid() and not public.is_admin() then
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
