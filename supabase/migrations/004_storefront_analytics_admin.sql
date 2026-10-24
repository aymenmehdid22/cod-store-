-- ============================================================
-- 004 — Multi-item cart orders, server-side quotes, analytics RPCs, CRM,
--       store pages, last-owner protection, consent bookkeeping.
-- ============================================================

-- ---- orders: multi-item support + consent / purchase-event bookkeeping
alter table public.orders drop constraint if exists orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (quantity > 0);
alter table public.orders
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists purchase_event_sent_at timestamptz;
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create unique index if not exists analytics_purchase_once on public.analytics_events (order_id) where event_name = 'Purchase';

-- ---- product slugs cannot shadow the storefront's own routes
alter table public.products drop constraint if exists products_slug_not_reserved;
alter table public.products add constraint products_slug_not_reserved
  check (slug not in ('admin','api','shop','cart','checkout','category','p','order-confirmation','sitemap','robots','favicon'));

-- ---- protect the last owner
create or replace function public.protect_last_owner()
returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and (select count(*) from public.admin_users where role = 'owner' and user_id <> old.user_id) = 0 then
    raise exception 'LAST_OWNER: at least one owner must remain';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists admin_users_last_owner on public.admin_users;
create trigger admin_users_last_owner before update or delete on public.admin_users
  for each row execute function public.protect_last_owner();

-- ---- store pages (legal / FAQ / contact / shipping / returns), plain text, no HTML
create table if not exists public.store_pages (
  slug          text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  title         text not null,
  title_ar      text,
  body          text not null default '',
  body_ar       text,
  is_published  boolean not null default true,
  show_in_footer boolean not null default true,
  sort_order    int not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.store_pages enable row level security;
create policy pages_public_read on public.store_pages for select to anon, authenticated
  using (is_published or public.is_admin());
create policy pages_staff_write on public.store_pages for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));
create trigger audit_pages after insert or update or delete on public.store_pages
  for each row execute function public.audit_row_change('slug');
create trigger audit_content after insert or update or delete on public.content_sections
  for each row execute function public.audit_row_change('id');

-- ============================================================
-- Cart pricing (shared by quote_order and place_order)
-- ============================================================
create or replace function public._cart_lines(p_items jsonb)
returns table (product_id uuid, variant_id uuid, product_slug text, product_name text, variant_key text,
               variant_name text, sku text, quantity int, unit_price int, track boolean, currency text)
language plpgsql stable security definer set search_path = public as $$
declare r record; pr public.products%rowtype; va public.product_variants%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 10 then
    raise exception 'INVALID_ITEMS';
  end if;
  for r in
    select x.product_id as pid, x.variant_id as vid, coalesce(sum(x.quantity), 0)::int as qty
    from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity int)
    group by x.product_id, x.variant_id order by x.product_id, x.variant_id
  loop
    if r.pid is null or r.qty < 1 or r.qty > 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into pr from public.products where id = r.pid and status = 'active' and delivery_available;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    va := null;
    if exists (select 1 from public.product_variants v where v.product_id = pr.id) then
      if r.vid is null then raise exception 'VARIANT_REQUIRED'; end if;
      select * into va from public.product_variants v where v.id = r.vid and v.product_id = pr.id;
      if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
      if not va.is_available then raise exception 'VARIANT_UNAVAILABLE'; end if;
      if pr.track_inventory and va.stock_quantity < r.qty then raise exception 'OUT_OF_STOCK'; end if;
    elsif pr.track_inventory and pr.stock_quantity < r.qty then
      raise exception 'OUT_OF_STOCK';
    end if;
    return query select pr.id, va.id, pr.slug, pr.name, va.key, va.name, coalesce(va.sku, pr.sku), r.qty,
                        coalesce(va.price_override, pr.price), pr.track_inventory, pr.currency;
  end loop;
end $$;

create or replace function public._discount_amount(p_code text, p_subtotal int)
returns int language plpgsql stable security definer set search_path = public as $$
declare d public.discounts%rowtype; v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
begin
  if v_code is null then return 0; end if;
  select * into d from public.discounts where code = v_code;
  if not found or not d.is_active
     or (d.starts_at is not null and d.starts_at > now())
     or (d.ends_at is not null and d.ends_at < now())
     or (d.usage_limit is not null and d.used_count >= d.usage_limit)
     or p_subtotal < d.min_subtotal then
    raise exception 'DISCOUNT_INVALID';
  end if;
  return least(p_subtotal, case d.type when 'percent' then (p_subtotal * d.value) / 100 else d.value end);
end $$;

-- Shipping: per-wilaya rate (if configured and active) else 0; free above the optional threshold setting.
create or replace function public._shipping_fee(p_wilaya text, p_delivery text, p_net int)
returns int language plpgsql stable security definer set search_path = public as $$
declare v_fee int; v_free int;
begin
  select (value #>> '{}')::int into v_free from public.store_settings
   where key = 'shipping.free_over' and jsonb_typeof(value) = 'number';
  if v_free is not null and v_free > 0 and p_net >= v_free then return 0; end if;
  select case when p_delivery = 'home' then home_fee else stopdesk_fee end into v_fee
    from public.shipping_rates where wilaya_code = p_wilaya and is_active;
  return coalesce(v_fee, 0);
end $$;

-- Quote (no side effects): what the customer will pay. Server only.
create or replace function public.quote_order(p_items jsonb, p_wilaya text, p_delivery text, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sub int; v_disc int; v_ship int; v_lines jsonb;
begin
  select coalesce(sum(l.unit_price * l.quantity), 0),
         jsonb_agg(jsonb_build_object('product_id', l.product_id, 'variant_id', l.variant_id, 'unit_price', l.unit_price, 'quantity', l.quantity))
    into v_sub, v_lines from public._cart_lines(p_items) l;
  v_disc := public._discount_amount(p_code, v_sub);
  v_ship := case when p_wilaya is null or p_wilaya = '' then 0 else public._shipping_fee(p_wilaya, coalesce(p_delivery, 'home'), v_sub - v_disc) end;
  return jsonb_build_object('lines', v_lines, 'subtotal', v_sub, 'discount', v_disc, 'shipping', v_ship,
                            'total', v_sub - v_disc + v_ship, 'shipping_known', (p_wilaya is not null and p_wilaya <> ''));
end $$;
revoke all on function public._cart_lines(jsonb), public._discount_amount(text, int), public._shipping_fee(text, text, int),
  public.quote_order(jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.quote_order(jsonb, text, text, text) to service_role;

-- ============================================================
-- place_order (cart version) — replaces the single-item function from 002
-- ============================================================
drop function if exists public.place_order(uuid, uuid, int, text, text, text, text, text, text, text, text, text, jsonb, text);

create or replace function public.place_order(
  p_items jsonb,
  p_customer_name text, p_phone text, p_wilaya_code text, p_wilaya_name text,
  p_delivery_type text, p_commune text, p_address text, p_stopdesk text,
  p_discount_code text, p_attribution jsonb, p_idempotency_key text, p_marketing_consent boolean default false
) returns table (order_id uuid, order_number text, total_price int, replayed boolean)
language plpgsql security definer set search_path = public as $$
declare
  l record; v_after int; v_sub int := 0; v_disc int := 0; v_ship int := 0; v_total int; v_qty int := 0;
  v_customer uuid; v_order uuid; v_number text; v_code text := nullif(upper(trim(coalesce(p_discount_code, ''))), '');
  v_first record; v_n int := 0; v_maxprice int := 1; v_moves jsonb := '[]'::jsonb; m jsonb; v_lines jsonb := '[]'::jsonb;
begin
  if p_idempotency_key is not null then
    select o.id, o.order_number, o.total_price into v_order, v_number, v_total
    from public.orders o where o.idempotency_key = p_idempotency_key;
    if found then return query select v_order, v_number, v_total, true; return; end if;
  end if;

  -- Pass 1: validate + price (stable function), then atomically decrement stock in a fixed order (no deadlocks).
  for l in select * from public._cart_lines(p_items) loop
    v_n := v_n + 1;
    if v_n = 1 then v_first := l; end if;
    v_sub := v_sub + l.unit_price * l.quantity;
    v_qty := v_qty + l.quantity;
    v_maxprice := greatest(v_maxprice, l.unit_price);
    v_lines := v_lines || jsonb_build_object('product_id', l.product_id, 'variant_id', l.variant_id, 'product_name', l.product_name,
      'variant_name', l.variant_name, 'sku', l.sku, 'quantity', l.quantity, 'unit_price', l.unit_price);
    v_after := null;
    if l.track then
      if l.variant_id is not null then
        update public.product_variants set stock_quantity = stock_quantity - l.quantity
          where id = l.variant_id and stock_quantity >= l.quantity returning stock_quantity into v_after;
      else
        update public.products set stock_quantity = stock_quantity - l.quantity
          where id = l.product_id and stock_quantity >= l.quantity returning stock_quantity into v_after;
      end if;
      if v_after is null then raise exception 'OUT_OF_STOCK'; end if;
      v_moves := v_moves || jsonb_build_object('product_id', l.product_id, 'variant_id', l.variant_id, 'qty', l.quantity, 'after', v_after);
    end if;
  end loop;

  if v_code is not null then
    v_disc := public._discount_amount(v_code, v_sub);
    update public.discounts set used_count = used_count + 1
      where code = v_code and (usage_limit is null or used_count < usage_limit);
    if not found then raise exception 'DISCOUNT_INVALID'; end if;
  end if;
  v_ship := public._shipping_fee(p_wilaya_code, p_delivery_type, v_sub - v_disc);
  v_total := v_sub - v_disc + v_ship;
  if v_total <= 0 then raise exception 'INVALID_TOTAL'; end if;

  insert into public.customers (phone, name, wilaya_code, wilaya_name, first_order_at)
  values (p_phone, p_customer_name, p_wilaya_code, p_wilaya_name, now())
  on conflict (phone) do update set name = excluded.name, wilaya_code = excluded.wilaya_code, wilaya_name = excluded.wilaya_name
  returning id into v_customer;

  insert into public.orders (
    product_id, product_name, variant_id, variant_name, quantity, unit_price, total_price, currency,
    customer_name, phone, wilaya_code, wilaya_name, delivery_type, commune, address, stopdesk,
    utm_source, utm_medium, utm_campaign, utm_content, fbclid,
    subtotal, discount_amount, discount_code, shipping_fee, customer_id, product_ref, idempotency_key, marketing_consent
  ) values (
    v_first.product_slug,
    case when v_n > 1 then v_first.product_name || ' (+' || (v_n - 1) || ')' else v_first.product_name end,
    case when v_n = 1 then v_first.variant_key end, case when v_n = 1 then v_first.variant_name end,
    v_qty, case when v_n = 1 then greatest(v_first.unit_price, 1) else v_maxprice end, v_total, v_first.currency,
    p_customer_name, p_phone, p_wilaya_code, p_wilaya_name, p_delivery_type,
    case when p_delivery_type = 'home' then p_commune end,
    case when p_delivery_type = 'home' then p_address end,
    case when p_delivery_type = 'stopdesk' then p_stopdesk end,
    p_attribution->>'utm_source', p_attribution->>'utm_medium', p_attribution->>'utm_campaign',
    p_attribution->>'utm_content', p_attribution->>'fbclid',
    v_sub, v_disc, v_code, v_ship, v_customer, v_first.product_id, p_idempotency_key, coalesce(p_marketing_consent, false)
  ) returning id, orders.order_number into v_order, v_number;

  insert into public.order_items (order_id, product_ref, variant_ref, product_name, variant_name, sku, quantity, unit_price, line_total)
  select v_order, c.product_id, c.variant_id, c.product_name, c.variant_name, c.sku, c.quantity, c.unit_price, c.unit_price * c.quantity
  from jsonb_to_recordset(v_lines) as c(product_id uuid, variant_id uuid, product_name text, variant_name text, sku text, quantity int, unit_price int);
  -- (lines come from pass 1: re-running _cart_lines here would re-validate against the already-decremented stock)

  for m in select * from jsonb_array_elements(v_moves) loop
    insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, order_id)
    values ((m->>'product_id')::uuid, nullif(m->>'variant_id', '')::uuid, -(m->>'qty')::int, (m->>'after')::int, 'order_placed', v_order);
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note) values (v_order, null, 'new', 'Commande créée');
  return query select v_order, v_number, v_total, false;
end $$;
revoke all on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, jsonb, text, boolean) to service_role;

-- Delivered orders produce exactly one first-party Purchase event (revenue is only "realised" on delivery for COD).
create or replace function public.admin_set_order_status(p_order_id uuid, p_to text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; it record; v_after int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not public.order_transition_allowed(o.status, p_to) then
    raise exception 'INVALID_TRANSITION: % -> %', o.status, p_to;
  end if;

  if p_to in ('cancelled', 'returned') and not o.stock_released then
    for it in select * from public.order_items where order_id = o.id and product_ref is not null loop
      if it.variant_ref is not null then
        update public.product_variants set stock_quantity = stock_quantity + it.quantity
          where id = it.variant_ref returning stock_quantity into v_after;
      else
        update public.products set stock_quantity = stock_quantity + it.quantity
          where id = it.product_ref and track_inventory returning stock_quantity into v_after;
      end if;
      if v_after is not null then
        insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, order_id, created_by)
        values (it.product_ref, it.variant_ref, it.quantity, v_after,
                case when p_to = 'cancelled' then 'order_cancelled' else 'order_returned' end, o.id, auth.uid());
      end if;
      v_after := null;
    end loop;
    update public.orders set stock_released = true where id = o.id;
  end if;

  if p_to = 'delivered' then
    insert into public.analytics_events (event_name, order_id, value, currency)
    values ('Purchase', o.id, o.total_price, o.currency) on conflict do nothing;
  end if;

  update public.orders set status = p_to, updated_at = now() where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (o.id, o.status, p_to, auth.uid(), p_note);
  perform public.write_audit('order.status', 'order', o.id::text, jsonb_build_object('from', o.status, 'to', p_to));
  return p_to;
end $$;

-- ============================================================
-- Analytics (aggregated in the database; ranges are Africa/Algiers calendar days, inclusive)
-- ============================================================
create or replace function public.admin_analytics(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := (p_from::timestamp at time zone 'Africa/Algiers');
  t1 timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Algiers');
  r jsonb;
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_RANGE'; end if;

  with o as (
    select o.*, (o.status not in ('cancelled','returned')) as live,
           row_number() over (partition by o.customer_id order by o.created_at) as nth
    from public.orders o
  ), ro as (select * from o where created_at >= t0 and created_at < t1),
  tot as (
    select count(*) placed,
           coalesce(sum(subtotal), 0) gross,
           coalesce(sum(discount_amount), 0) discounts,
           coalesce(sum(subtotal - discount_amount) filter (where status = 'cancelled'), 0) cancelled_value,
           coalesce(sum(subtotal - discount_amount) filter (where status = 'returned'), 0) returned_value,
           coalesce(sum(subtotal - discount_amount) filter (where live), 0) net,
           coalesce(sum(subtotal - discount_amount) filter (where status = 'delivered'), 0) delivered_rev,
           coalesce(sum(shipping_fee) filter (where live), 0) shipping,
           count(*) filter (where live) live_orders,
           count(*) filter (where status = 'cancelled') cancelled,
           count(*) filter (where status = 'returned') returned,
           count(*) filter (where status = 'delivered') delivered,
           count(*) filter (where nth = 1) new_orders,
           count(*) filter (where nth > 1) returning_orders,
           count(distinct customer_id) filter (where nth = 1) new_customers,
           count(distinct customer_id) filter (where nth > 1) returning_customers
    from ro
  ), days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ), daily as (
    select d.day, count(ro.id) orders, coalesce(sum(ro.subtotal - ro.discount_amount) filter (where ro.live), 0) net
    from days d left join ro on (ro.created_at at time zone 'Africa/Algiers')::date = d.day
    group by d.day order by d.day
  ), items as (
    select i.*, ro.id as oid from public.order_items i join ro on ro.id = i.order_id where ro.live
  ), top_p as (
    select product_name name, sum(quantity) units, sum(line_total) revenue from items group by product_name order by sum(line_total) desc limit 10
  ), top_c as (
    select c.name, sum(i.quantity) units, sum(i.line_total) revenue
    from items i join public.product_categories pc on pc.product_id = i.product_ref join public.categories c on c.id = pc.category_id
    group by c.name order by sum(i.line_total) desc limit 10
  ), acq as (
    select coalesce(nullif(utm_source, ''), 'direct / inconnu') source, count(*) orders,
           coalesce(sum(subtotal - discount_amount) filter (where live), 0) net
    from ro group by 1 order by count(*) desc limit 10
  ), camp as (
    select utm_campaign campaign, coalesce(nullif(utm_source, ''), '—') source, count(*) orders,
           coalesce(sum(subtotal - discount_amount) filter (where live), 0) net
    from ro where utm_campaign is not null and utm_campaign <> '' group by 1, 2 order by count(*) desc limit 10
  ), ev as (
    select * from public.analytics_events where occurred_at >= t0 and occurred_at < t1 and event_name <> 'Purchase'
  ), funnel as (
    select count(distinct session_id) filter (where event_name = 'PageView') sessions,
           count(distinct session_id) filter (where event_name = 'ViewContent') view_content,
           count(distinct session_id) filter (where event_name = 'AddToCart') add_to_cart,
           count(distinct session_id) filter (where event_name = 'InitiateCheckout') initiate_checkout,
           count(distinct session_id) filter (where event_name = 'Lead') lead
    from ev
  ), abandoned as (
    select count(*) n from (
      select session_id from ev where session_id is not null
      group by session_id
      having bool_or(event_name = 'InitiateCheckout') and not bool_or(event_name = 'Lead')
    ) s
  ), prod_views as (
    select p.name, count(*) filter (where e.event_name = 'ViewContent') views, count(*) filter (where e.event_name = 'AddToCart') adds
    from ev e join public.products p on p.id = e.product_ref where e.event_name in ('ViewContent', 'AddToCart')
    group by p.name order by count(*) desc limit 10
  ), inv as (
    select p.name, p.track_inventory,
           case when exists (select 1 from public.product_variants v where v.product_id = p.id)
                then (select coalesce(sum(v.stock_quantity), 0) from public.product_variants v where v.product_id = p.id)
                else p.stock_quantity end stock,
           coalesce((select sum(i.quantity) from items i where i.product_ref = p.id), 0) units_sold
    from public.products p where p.status = 'active' and p.track_inventory
    order by units_sold desc limit 20
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', 'Africa/Algiers'),
    'totals', (select to_jsonb(tot) from tot),
    'aov', (select case when live_orders > 0 then round(net::numeric / live_orders) end from tot),
    'cancellation_rate', (select case when placed > 0 then round(100.0 * cancelled / placed, 1) end from tot),
    'return_rate', (select case when delivered + returned > 0 then round(100.0 * returned / (delivered + returned), 1) end from tot),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from ro group by status) s),
    'daily', (select jsonb_agg(to_jsonb(daily) order by day) from daily),
    'top_products', (select coalesce(jsonb_agg(to_jsonb(top_p)), '[]') from top_p),
    'top_categories', (select coalesce(jsonb_agg(to_jsonb(top_c)), '[]') from top_c),
    'acquisition', (select coalesce(jsonb_agg(to_jsonb(acq)), '[]') from acq),
    'campaigns', (select coalesce(jsonb_agg(to_jsonb(camp)), '[]') from camp),
    'funnel', (select to_jsonb(funnel) from funnel),
    'abandoned_checkouts', (select n from abandoned),
    'product_views', (select coalesce(jsonb_agg(to_jsonb(prod_views)), '[]') from prod_views),
    'inventory', (select coalesce(jsonb_agg(to_jsonb(inv)), '[]') from inv)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_analytics(date, date) from public, anon;
grant execute on function public.admin_analytics(date, date) to authenticated;

-- ============================================================
-- CRM
-- ============================================================
create or replace function public.admin_customers(p_q text, p_segment text, p_limit int, p_offset int)
returns table (id uuid, name text, phone text, wilaya_name text, tags text[], orders int, total_spent bigint,
               aov int, first_order_at timestamptz, last_order_at timestamptz, segment text, lapsed boolean, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  with s as (
    select c.id, c.name, c.phone, c.wilaya_name, c.tags,
           count(o.id) filter (where o.status not in ('cancelled','returned'))::int as orders,
           coalesce(sum(o.total_price) filter (where o.status not in ('cancelled','returned')), 0)::bigint as total_spent,
           min(o.created_at) as first_order_at,
           max(o.created_at) filter (where o.status not in ('cancelled','returned')) as last_order_at
    from public.customers c left join public.orders o on o.customer_id = c.id
    where (p_q is null or p_q = '' or c.name ilike '%' || p_q || '%' or c.phone ilike '%' || p_q || '%')
    group by c.id
  ), t as (
    select s.*,
      case when s.orders = 0 then 'prospect' when s.orders = 1 then 'new' when s.orders = 2 then 'returning' else 'loyal' end as segment,
      (s.last_order_at is not null and s.last_order_at < now() - interval '90 days') as lapsed
    from s
  )
  select t.id, t.name, t.phone, t.wilaya_name, t.tags, t.orders, t.total_spent,
         case when t.orders > 0 then (t.total_spent / t.orders)::int end, t.first_order_at, t.last_order_at, t.segment, t.lapsed,
         count(*) over () as total_count
  from t
  where p_segment is null or p_segment = '' or (p_segment = 'lapsed' and t.lapsed) or t.segment = p_segment
  order by t.last_order_at desc nulls last, t.name
  limit greatest(1, least(coalesce(p_limit, 25), 5000)) offset greatest(0, coalesce(p_offset, 0));
end $$;
revoke all on function public.admin_customers(text, text, int, int) from public, anon;
grant execute on function public.admin_customers(text, text, int, int) to authenticated;

-- ============================================================
-- Seed: shipping threshold setting key, home sections, default pages (templates to review!)
-- ============================================================
insert into public.store_settings (key, value, is_public) values
  ('store.logo_url', 'null', true), ('store.favicon_url', 'null', true),
  ('store.seo', '{"title_suffix":"COD Store","description":"Paiement à la livraison — 58 wilayas.","og_image":null}', true),
  ('shipping.free_over', 'null', true),
  ('home.layout', '{"single_product_redirect":true,"featured_count":8}', true)
on conflict (key) do nothing;

insert into public.content_sections (page, section_key, sort_order, is_visible, content) values
  ('home', 'hero', 0, true, '{"image_url":null,"fr":{"title":"Votre style, livré chez vous","subtitle":"Paiement à la livraison dans les 58 wilayas.","cta":"Voir la boutique"},"ar":{"title":"أسلوبك يصلك إلى باب بيتك","subtitle":"الدفع عند الاستلام في 58 ولاية.","cta":"تسوق الآن"}}'),
  ('home', 'featured', 1, true, '{"fr":{"title":"Nos produits"},"ar":{"title":"منتجاتنا"}}'),
  ('home', 'categories', 2, true, '{"fr":{"title":"Catégories"},"ar":{"title":"الفئات"}}'),
  ('home', 'trust', 3, true, '{"items":[{"fr":"Paiement à la livraison","ar":"الدفع عند الاستلام"},{"fr":"Livraison 58 wilayas","ar":"التوصيل إلى 58 ولاية"},{"fr":"À domicile ou Stopdesk","ar":"إلى المنزل أو مكتب التوصيل"}]}')
on conflict (page, section_key) do nothing;

insert into public.store_pages (slug, title, title_ar, body, body_ar, sort_order) values
 ('shipping', 'Livraison', 'التوصيل',
  E'## Zones et délais\nNous livrons dans les 58 wilayas, à domicile ou en point Stopdesk. Un conseiller vous appelle pour confirmer la commande et la date de livraison.\n\n## Paiement\nLe paiement se fait en espèces à la réception du colis.',
  E'## المناطق والآجال\nنوصل إلى 58 ولاية، إلى المنزل أو إلى مكتب التوصيل. سيتصل بك أحد مستشارينا لتأكيد الطلب وموعد التسليم.\n\n## الدفع\nيتم الدفع نقداً عند استلام الطلب.', 1),
 ('returns', 'Retours', 'الإرجاع',
  E'## Retours\nVérifiez votre colis à la réception. Pour toute question ou demande de retour, contactez-nous avec votre numéro de commande.',
  E'## الإرجاع\nيرجى فحص الطلب عند الاستلام. لأي سؤال أو طلب إرجاع، تواصل معنا مع ذكر رقم الطلب.', 2),
 ('faq', 'Questions fréquentes', 'الأسئلة الشائعة',
  E'## Comment commander ?\nChoisissez votre produit, remplissez le formulaire, puis nous vous appelons pour confirmer.\n\n## Comment payer ?\nEn espèces à la livraison.',
  E'## كيف أطلب؟\nاختر المنتج واملأ النموذج، ثم نتصل بك للتأكيد.\n\n## كيف أدفع؟\nنقداً عند الاستلام.', 3),
 ('contact', 'Contact', 'اتصل بنا',
  E'Retrouvez nos coordonnées ci-dessous. Nous répondons du dimanche au jeudi.',
  E'تجد معلومات الاتصال أدناه. نرد من الأحد إلى الخميس.', 4),
 ('privacy', 'Politique de confidentialité', 'سياسة الخصوصية',
  E'## Données collectées\nNom, téléphone, wilaya et adresse de livraison, uniquement pour traiter votre commande. Les outils de mesure (Meta, Google, TikTok) ne sont activés qu''avec votre consentement.\n\n## Vos droits\nVous pouvez demander l''accès, la rectification ou la suppression de vos données en nous contactant.',
  E'## البيانات المجمعة\nالاسم والهاتف والولاية وعنوان التوصيل، فقط لمعالجة طلبك. لا تُفعَّل أدوات القياس (Meta وGoogle وTikTok) إلا بموافقتك.\n\n## حقوقك\nيمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها عبر التواصل معنا.', 5),
 ('terms', 'Conditions générales de vente', 'شروط البيع',
  E'## Commande\nUne commande est considérée comme confirmée après appel de notre équipe.\n\n## Prix\nLes prix sont affichés en dinars algériens (DA).',
  E'## الطلب\nيُعتبر الطلب مؤكداً بعد اتصال فريقنا بك.\n\n## الأسعار\nالأسعار معروضة بالدينار الجزائري.', 6)
on conflict (slug) do nothing;
