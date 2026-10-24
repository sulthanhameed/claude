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
