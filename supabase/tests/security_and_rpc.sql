-- Run after migrations on a scratch database:  psql -v ON_ERROR_STOP=1 -f supabase/tests/security_and_rpc.sql
-- Uses SET ROLE + request.jwt.claim.sub to emulate Supabase's anon / authenticated / service_role.
begin;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok  - %', msg; end $$;
create or replace function pg_temp.raises(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false;
exception when others then return position(expect in sqlerrm) > 0 or position(expect in sqlstate) > 0; end $$;
grant execute on function pg_temp.assert(boolean, text), pg_temp.raises(text, text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.dz'),
  ('00000000-0000-0000-0000-0000000000a2', 'operator@x.dz'),
  ('00000000-0000-0000-0000-0000000000a3', 'rando@x.dz');           -- self-signed-up stranger
insert into public.admin_users (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'order_operator');

-- Fixtures (as superuser)
insert into public.products (id, slug, name, price, status, stock_quantity) values
  ('11111111-1111-1111-1111-111111111111', 'plain-hat', 'Plain hat', 1000, 'active', 10),
  ('22222222-2222-2222-2222-222222222222', 'secret-draft', 'Draft', 500, 'draft', 1);
insert into public.discounts (code, type, value, min_subtotal, usage_limit) values ('SAVE10', 'percent', 10, 0, 1), ('OLD', 'fixed', 100, 0, null);
update public.discounts set ends_at = now() - interval '1 day', starts_at = now() - interval '2 day' where code = 'OLD';

-- ============ anon ============
set local role anon; select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert((select count(*) from public.products where status <> 'active') = 0 and (select count(*) from public.products) >= 1, 'anon sees ONLY active products (not drafts)');
select pg_temp.assert((select count(*) from public.products where slug = 'secret-draft') = 0, 'anon cannot read draft product');
select pg_temp.assert((select count(*) from public.orders) = 0, 'anon reads 0 orders');
select pg_temp.assert((select count(*) from public.customers) = 0, 'anon reads 0 customers');
select pg_temp.assert((select count(*) from public.discounts) = 0, 'anon cannot enumerate discount codes');
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'anon reads 0 audit logs');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]'::jsonb, 'A B C', '0550000001', '16', 'Alger', 'home', null, null, null, null, '{}', null)$$, 'permission denied'), 'anon cannot call place_order');
select pg_temp.assert(pg_temp.raises($$update public.products set price = 1 where slug = 'plain-hat'$$, 'permission') or (select price from public.products where slug='plain-hat') = 1000, 'anon cannot change prices');
select pg_temp.assert((select count(*) from public.tracking_integrations where enabled) = 0, 'anon sees only enabled tracking rows (none enabled)');
reset role;

-- ============ authenticated stranger (self-signup) ============
set local role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
select pg_temp.assert((select count(*) from public.orders) = 0, 'stranger reads 0 orders (legacy leak closed)');
select pg_temp.assert((select count(*) from public.customers) = 0, 'stranger reads 0 customers');
select pg_temp.assert(not public.is_admin(), 'stranger is not admin');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_order_status(gen_random_uuid(), 'confirmed')$$, 'FORBIDDEN'), 'stranger cannot change order status');
select pg_temp.assert(pg_temp.raises($$select public.admin_adjust_stock('11111111-1111-1111-1111-111111111111', null, 5, 'restock')$$, 'FORBIDDEN'), 'stranger cannot adjust stock');
select pg_temp.assert(pg_temp.raises($$select public.admin_save_product('{"slug":"x","name":"x","price":1}')$$, 'FORBIDDEN'), 'stranger cannot create products');
select pg_temp.assert(pg_temp.raises($$insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000000a3','owner')$$, 'row-level security'), 'stranger cannot self-promote to owner');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]'::jsonb, 'A B C', '0550000001', '16', 'Alger', 'home', null, null, null, null, '{}', null)$$, 'permission denied'), 'authenticated cannot call place_order');
reset role;

-- ============ service role: place_order ============
set local role service_role;
create temp table r1 on commit drop as select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":2}]'::jsonb, 'Test Client', '0550000001', '16', 'Alger', 'home', 'Bab', 'Rue 1', null, null, '{"utm_source":"fb"}', 'key-1');
select pg_temp.assert((select total_price from r1) = 2000, 'total computed server-side (2 x 1000)');
select pg_temp.assert((select stock_quantity from public.products where slug='plain-hat') = 8, 'stock decremented atomically 10 -> 8');
select pg_temp.assert((select count(*) from public.inventory_movements where reason='order_placed') = 1, 'inventory movement recorded');
select pg_temp.assert((select replayed from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":2}]'::jsonb, 'Test Client', '0550000001', '16', 'Alger', 'home', 'Bab', 'Rue 1', null, null, '{}', 'key-1')) = true, 'same idempotency key returns existing order (replayed)');
select pg_temp.assert((select count(*) from public.orders where idempotency_key='key-1') = 1 and (select stock_quantity from public.products where slug='plain-hat') = 8, 'replay did not duplicate order or stock');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":10}]'::jsonb, 'Test Client', '0550000001', '16', 'Alger', 'home', null, null, null, null, '{}', 'key-2')$$, 'OUT_OF_STOCK'), 'overselling blocked (wants 10, has 8)');
select pg_temp.assert((select stock_quantity from public.products where slug='plain-hat') = 8, 'failed order left stock untouched');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"22222222-2222-2222-2222-222222222222","quantity":1}]'::jsonb, 'Test Client', '0550000001', '16', 'Alger', 'home', null, null, null, null, '{}', null)$$, 'PRODUCT_UNAVAILABLE'), 'draft product cannot be ordered');
create temp table r3 on commit drop as select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]'::jsonb, 'Test Client', '0550000001', '16', 'Alger', 'home', null, null, null, 'save10', '{}', 'key-3');
select pg_temp.assert((select total_price from r3) = 900, 'percent discount applied server-side (case-insensitive code): 1000 -> 900');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]'::jsonb, 'T C X', '0550000001', '16', 'Alger', 'home', null, null, null, 'SAVE10', '{}', 'key-4')$$, 'DISCOUNT_INVALID'), 'usage-limited discount (limit 1) rejected on 2nd use');
select pg_temp.assert((select used_count from public.discounts where code='SAVE10') = 1, 'discount used_count incremented');
select pg_temp.assert(pg_temp.raises($$select * from public.place_order('[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]'::jsonb, 'T C X', '0550000001', '16', 'Alger', 'home', null, null, null, 'OLD', '{}', 'key-5')$$, 'DISCOUNT_INVALID'), 'expired discount rejected');
select pg_temp.assert((select count(*) from public.customers where phone='0550000001') = 1, 'customer upserted by phone (no duplicates)');
grant select on r1, r3 to public;
reset role;

-- (004 tests live in tests/cart_analytics_crm.sql)
-- ============ operator: status transitions ============
set local role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select pg_temp.assert((select count(*) from public.orders) >= 2, 'operator can read orders');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_set_order_status(%L, 'delivered')$$, (select order_id from r1)), 'INVALID_TRANSITION'), 'new -> delivered rejected');
select public.admin_set_order_status((select order_id from r1), 'confirmed', 'appel ok');
select pg_temp.assert((select status from public.orders where id=(select order_id from r1)) = 'confirmed', 'new -> confirmed ok');
select pg_temp.assert(pg_temp.raises($$select public.admin_adjust_stock('11111111-1111-1111-1111-111111111111', null, 5, 'restock')$$, 'FORBIDDEN'), 'operator cannot adjust stock');
select pg_temp.assert(pg_temp.raises($$select public.admin_save_product('{"slug":"x","name":"x","price":1}')$$, 'FORBIDDEN'), 'operator cannot edit catalogue');
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'operator cannot read audit logs');
select public.admin_set_order_status((select order_id from r1), 'cancelled', 'client injoignable');
reset role;
select pg_temp.assert((select stock_quantity from public.products where slug='plain-hat') = 9, 'cancel restocked 2 units exactly once (10 -2 -1 +2 = 9)');
set local role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select pg_temp.assert(pg_temp.raises(format($$select public.admin_set_order_status(%L, 'cancelled')$$, (select order_id from r1)), 'INVALID_TRANSITION'), 'cancelled is terminal (no double restock)');
select pg_temp.assert((select count(*) from public.order_status_history where order_id=(select order_id from r1)) = 3, 'history: created, confirmed, cancelled');
reset role;

-- ============ owner: catalogue + audit ============
set local role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
create temp table np on commit drop as select public.admin_save_product('{"slug":"new-cap","name":"New cap","price":2000,"compare_at_price":2500,"status":"active","benefits":["a"],
  "variants":[{"client_key":"k1","key":"red","name":"Rouge","color_hex":"#ff0000","stock_quantity":7},{"client_key":"k2","key":"blue","name":"Bleu","stock_quantity":0}],
  "images":[{"url":"https://x/y.jpg","alt":"r","variant_client_key":"k1","sort_order":0}]}') as id;
select pg_temp.assert((select count(*) from public.product_variants where product_id=(select id from np)) = 2, 'owner created product with 2 variants atomically');
select pg_temp.assert((select variant_id is not null from public.product_images where product_id=(select id from np)), 'image linked to variant via client_key');
select pg_temp.assert((select quantity_after from public.inventory_movements where product_id=(select id from np) and reason='initial') = 7, 'initial stock movement logged');
select pg_temp.assert(pg_temp.raises($$select public.admin_save_product('{"slug":"bad","name":"b","price":3000,"compare_at_price":100}')$$, 'products_compare_gt_price'), 'compare_at_price < price rejected by constraint');
-- editing must NOT overwrite stock
select public.admin_save_product(jsonb_build_object('id',(select id from np),'slug','new-cap','name','New cap v2','price',2000,'status','active',
  'variants',(select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name,'stock_quantity',999)) from public.product_variants where product_id=(select id from np))));
select pg_temp.assert((select stock_quantity from public.product_variants where key='red' and product_id=(select id from np)) = 7, 'edit does not overwrite stock (ledger stays truthful)');
select pg_temp.assert(public.admin_adjust_stock((select id from np), (select id from public.product_variants where key='red' and product_id=(select id from np)), -2, 'damage', 'cassé') = 5, 'owner adjusts stock with reason');
select pg_temp.assert(pg_temp.raises(format($$select public.admin_adjust_stock(%L, %L, -50, 'correction')$$, (select id from np), (select id from public.product_variants where key='red' and product_id=(select id from np))), 'INSUFFICIENT_STOCK'), 'stock cannot go negative');
select pg_temp.assert((select count(*) from public.audit_logs) >= 4, 'owner reads audit logs');
-- category with products cannot be deleted
insert into public.categories (id, slug, name) values ('33333333-3333-3333-3333-333333333333', 'hats', 'Hats');
insert into public.product_categories values ((select id from np), '33333333-3333-3333-3333-333333333333');
select pg_temp.assert(pg_temp.raises($$delete from public.categories where slug='hats'$$, 'foreign key'), 'non-empty category cannot be deleted');
-- tracking validation: arbitrary script / bad id rejected
select pg_temp.assert(pg_temp.raises($$update public.tracking_integrations set public_id='<script>alert(1)</script>', enabled=true where provider='meta_pixel'$$, 'tracking_id_format'), 'tracking id must match strict format (no JS)');
select pg_temp.assert(pg_temp.raises($$update public.tracking_integrations set enabled=true where provider='ga4'$$, 'tracking_enabled_needs_id'), 'cannot enable integration without an id');
update public.tracking_integrations set public_id='1234567890123456', enabled=true where provider='meta_pixel';
select pg_temp.assert(true, 'valid meta pixel id accepted');
select pg_temp.assert(true, 'owner section end');
-- bulk status / delete / export audit / generic audit trigger
select pg_temp.assert(public.admin_set_products_status(array[(select id from np)], 'archived') = 1, 'bulk status change works');
select pg_temp.assert((select count(*) from public.audit_logs where entity='categories' and action='insert') = 1, 'trigger audited category insert');
select public.admin_log_export('orders', 12);
select pg_temp.assert((select count(*) from public.audit_logs where action='export') = 1, 'customer-data export is audited');
select pg_temp.assert(array_length(public.admin_delete_product((select id from np)), 1) is null, 'product deleted via RPC (no storage paths)');
select pg_temp.assert((select count(*) from public.audit_logs where action='product.delete') = 1, 'product deletion audited');
reset role;

set local role anon; select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert((select count(*) from public.tracking_integrations where enabled) = 1, 'anon can read enabled public tracking config only');
select pg_temp.assert(pg_temp.raises($$select public.admin_delete_product(gen_random_uuid())$$, 'permission denied'), 'anon cannot delete products');

reset role;
reset role;
rollback;
