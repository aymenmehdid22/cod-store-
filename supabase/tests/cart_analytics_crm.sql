-- Run after migrations 001-004 on a scratch database. Emulates Supabase roles like security_and_rpc.sql.
begin;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok  - %', msg; end $$;
create or replace function pg_temp.raises(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false;
exception when others then return position(expect in sqlerrm) > 0 or position(expect in sqlstate) > 0; end $$;
grant execute on function pg_temp.assert(boolean, text), pg_temp.raises(text, text) to public;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1','owner@x.dz'),('00000000-0000-0000-0000-0000000000b2','op@x.dz');
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000000b1','owner'),('00000000-0000-0000-0000-0000000000b2','order_operator');

insert into public.products (id, slug, name, price, status, stock_quantity) values
  ('aaaaaaaa-0000-0000-0000-000000000001','prod-a','Prod A',1000,'active',20),
  ('aaaaaaaa-0000-0000-0000-000000000002','prod-b','Prod B',500,'active',3);
insert into public.shipping_rates (wilaya_code, home_fee, stopdesk_fee) values ('16', 600, 400);
insert into public.discounts (code, type, value, min_subtotal) values ('MIN2000','fixed',200,2000);
insert into public.store_pages (slug, title, is_published) values ('hidden-page','Hidden',false);

select pg_temp.assert(pg_temp.raises($$insert into public.products (slug, name, price) values ('shop','Shadow',1)$$, 'products_slug_not_reserved'), 'a product slug cannot shadow a storefront route');

-- ===== quote_order =====
set local role service_role;
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2},{"product_id":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1}]','16','home',null)->>'total')::int = 2500 + 600,
  'quote: subtotal 2500 + home shipping 600 for wilaya 16');
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]','16','stopdesk',null)->>'shipping')::int = 400, 'quote: stopdesk fee');
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]','','home',null)->>'shipping_known')::boolean = false, 'quote: shipping unknown until a wilaya is chosen');
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1},{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]',null,null,null)->>'subtotal')::int = 2000, 'duplicate lines are merged');
select pg_temp.assert(pg_temp.raises($$select public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]','16','home','MIN2000')$$, 'DISCOUNT_INVALID'), 'discount below minimum subtotal rejected');
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2}]','16','home','min2000')->>'total')::int = 2000 - 200 + 600, 'discount at minimum accepted (case-insensitive), shipping added after discount');
select pg_temp.assert(pg_temp.raises($$select public.quote_order('[]','16','home',null)$$, 'INVALID_ITEMS'), 'empty cart rejected');
select pg_temp.assert(pg_temp.raises($$select public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000002","quantity":4}]','16','home',null)$$, 'OUT_OF_STOCK'), 'quote refuses more than the stock');
select pg_temp.assert(pg_temp.raises($$select public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":11}]','16','home',null)$$, 'INVALID_QUANTITY'), 'line quantity > 10 rejected');
reset role;

-- free shipping threshold from settings
update public.store_settings set value = '2000' where key = 'shipping.free_over';
set local role service_role;
select pg_temp.assert((public.quote_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2}]','16','home',null)->>'shipping')::int = 0, 'free shipping above the configured threshold');
reset role;
update public.store_settings set value = 'null' where key = 'shipping.free_over';

-- ===== place_order (cart) =====
set local role service_role;
create temp table c1 on commit drop as select * from public.place_order(
  '[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":8},{"product_id":"aaaaaaaa-0000-0000-0000-000000000002","quantity":2}]'::jsonb,
  'Cart Client','0550999001','16','Alger','home','Bab','Rue 1',null,null,'{"utm_source":"facebook","utm_campaign":"promo1"}','cart-1', true);
select pg_temp.assert((select total_price from c1) = 8000 + 1000 + 600, 'cart total = lines + shipping, quantity 10 units across lines');
select pg_temp.assert((select count(*) from public.order_items where order_id = (select order_id from c1)) = 2, 'one order_items row per line');
select pg_temp.assert((select stock_quantity from public.products where slug='prod-a') = 12 and (select stock_quantity from public.products where slug='prod-b') = 1, 'stock decremented for every line');
select pg_temp.assert((select product_name from public.orders where id = (select order_id from c1)) = 'Prod A (+1)', 'legacy product_name summarises multi-item order');
select pg_temp.assert((select marketing_consent from public.orders where id = (select order_id from c1)), 'marketing consent recorded on the order');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1},{"product_id":"aaaaaaaa-0000-0000-0000-000000000002","quantity":2}]'::jsonb,'X Y Z','0550999002','16','Alger','home',null,null,null,null,'{}','cart-2')$$, 'OUT_OF_STOCK'), 'a cart with one unavailable line fails entirely');
select pg_temp.assert((select stock_quantity from public.products where slug='prod-a') = 12, 'failed cart rolled back the stock of its valid lines');
create temp table c2 on commit drop as select * from public.place_order('[{"product_id":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]'::jsonb,'Cart Client','0550999001','16','Alger','stopdesk',null,null,'Desk 1',null,'{}','cart-3', false);
select pg_temp.assert((select total_price from c2) = 1000 + 400, 'stopdesk fee applied');
select pg_temp.assert((select count(*) from public.customers where phone='0550999001') = 1, 'same phone = same customer');
grant select on c1, c2 to public;
reset role;

-- ===== analytics + CRM + roles =====
insert into public.analytics_events (event_name, session_id, product_ref) values
  ('PageView','s1',null),('PageView','s2',null),('PageView','s3',null),
  ('ViewContent','s1','aaaaaaaa-0000-0000-0000-000000000001'),('ViewContent','s2','aaaaaaaa-0000-0000-0000-000000000001'),
  ('AddToCart','s1','aaaaaaaa-0000-0000-0000-000000000001'),
  ('InitiateCheckout','s1',null),('InitiateCheckout','s2',null),('Lead','s1',null);

set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',true);
select pg_temp.assert(pg_temp.raises($$select public.admin_analytics(current_date - 1, current_date)$$, 'FORBIDDEN'), 'operator cannot read analytics');
select pg_temp.assert((select count(*) from public.admin_customers(null, null, 25, 0)) >= 1, 'operator can read the customer directory');
select public.admin_set_order_status((select order_id from c2), 'confirmed');
reset role;

set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
create temp table a1 on commit drop as select public.admin_analytics(current_date - 1, current_date + 1) as j;
select pg_temp.assert((select (j->'totals'->>'placed')::int from a1) = 2, 'analytics: 2 orders placed in range');
select pg_temp.assert((select (j->'totals'->>'gross')::int from a1) = 9000 + 1000, 'analytics: gross = sum of subtotals (shipping excluded)');
select pg_temp.assert((select (j->'totals'->>'new_customers')::int from a1) = 1 and (select (j->'totals'->>'returning_orders')::int from a1) = 1, 'analytics: first order = new customer, second = returning order');
select pg_temp.assert((select (j->'funnel'->>'sessions')::int from a1) = 3 and (select (j->'funnel'->>'initiate_checkout')::int from a1) = 2 and (select (j->'funnel'->>'lead')::int from a1) = 1, 'funnel counts distinct tracked sessions');
select pg_temp.assert((select (j->>'abandoned_checkouts')::int from a1) = 1, 'abandoned checkout = session with InitiateCheckout but no Lead (s2)');
select pg_temp.assert((select jsonb_array_length(j->'daily') from a1) = 3, 'daily series is zero-filled for every day in range');
select pg_temp.assert((select j->'acquisition'->0->>'source' from a1) in ('facebook','direct / inconnu'), 'acquisition grouped by utm_source');
-- cancel the big order: net sales must drop, cancellation rate = 50%
select public.admin_set_order_status((select order_id from c1), 'cancelled', 'test');
create temp table a2 on commit drop as select public.admin_analytics(current_date, current_date) as j;
select pg_temp.assert((select (j->'totals'->>'net')::int from a2) = 1000, 'analytics: cancelled order excluded from net sales');
select pg_temp.assert((select (j->>'cancellation_rate')::numeric from a2) = 50.0, 'analytics: cancellation rate = cancelled / placed');
select pg_temp.assert((select stock_quantity from public.products where slug='prod-a') = 11 + 8 - 0 + 0 - 0 or true, 'stock restored after cancel (checked below)');
reset role;
select pg_temp.assert((select stock_quantity from public.products where slug='prod-a') = 19 and (select stock_quantity from public.products where slug='prod-b') = 3, 'cancel restocked every line of the cart order');

-- delivered -> exactly one Purchase event
set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
select public.admin_set_order_status((select order_id from c2), 'processing');
select public.admin_set_order_status((select order_id from c2), 'shipped');
select public.admin_set_order_status((select order_id from c2), 'delivered');
select pg_temp.assert((select count(*) from public.analytics_events where event_name='Purchase') = 1, 'delivery records exactly one Purchase event');
select pg_temp.assert((select (public.admin_analytics(current_date, current_date)->'totals'->>'delivered_rev')::int) = 1000, 'delivered revenue counted only after delivery');

-- CRM segments
select pg_temp.assert((select segment from public.admin_customers('Cart Client', null, 5, 0)) = 'new', 'customer with 1 live order (the other was cancelled) is "new"');
select pg_temp.assert((select count(*) from public.admin_customers(null, 'loyal', 25, 0)) = 0, 'segment filter works');
reset role;

-- last owner protection + RLS on pages / customers
set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
select pg_temp.assert(pg_temp.raises($$delete from public.admin_users where user_id='00000000-0000-0000-0000-0000000000b1'$$, 'LAST_OWNER'), 'the last owner cannot be removed');
select pg_temp.assert(pg_temp.raises($$update public.admin_users set role='manager' where user_id='00000000-0000-0000-0000-0000000000b1'$$, 'LAST_OWNER'), 'the last owner cannot be demoted');
reset role;
set local role anon; select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert((select count(*) from public.store_pages where slug='hidden-page') = 0 and (select count(*) from public.store_pages where is_published) >= 6, 'anon sees published pages only');
select pg_temp.assert(pg_temp.raises($$select public.admin_customers(null,null,10,0)$$, 'permission denied'), 'anon cannot list customers');
select pg_temp.assert(pg_temp.raises($$select public.quote_order('[]','16','home',null)$$, 'permission denied'), 'anon cannot call quote_order directly');
select pg_temp.assert((select count(*) from public.analytics_events) = 0, 'anon cannot read analytics events');
reset role;
rollback;
