-- ============================================================
-- 002 — Commerce core: catalogue, stock, customers, discounts,
--       settings, tracking config, roles, audit, RLS, RPCs, storage.
-- Backward compatible: `orders` is extended, never recreated.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Generic helpers
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------
-- Admin roles. Roles live ONLY in this table (never in user
-- metadata, which the client can write). Rows are created by an
-- owner or by the SQL editor / service role.
-- ------------------------------------------------------------
do $$ begin
  create type public.admin_role as enum ('owner', 'manager', 'order_operator');
exception when duplicate_object then null; end $$;

create table if not exists public.admin_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         public.admin_role not null,
  display_name text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create or replace function public.current_admin_role()
returns public.admin_role
language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

create or replace function public.has_role(roles public.admin_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_admin_role() = any (roles), false)
$$;

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  actor_role text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, details)
  values (auth.uid(), public.current_admin_role()::text, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Catalogue
-- ------------------------------------------------------------
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'category' check (kind in ('category', 'collection')),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (length(name) between 1 and 120),
  name_ar          text,
  description      text,
  description_ar   text,
  image_url        text,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text not null check (length(name) between 1 and 200),
  description         text,
  price               int  not null check (price >= 0),
  compare_at_price    int  check (compare_at_price is null or compare_at_price >= 0),
  currency            text not null default 'DZD',
  sku                 text unique,
  status              text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  rating              numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  benefits            jsonb not null default '[]'::jsonb,
  translations        jsonb not null default '{}'::jsonb,   -- { "ar": { name, description, benefits[] } }
  tags                text[] not null default '{}',
  delivery_available  boolean not null default true,
  track_inventory     boolean not null default true,
  stock_quantity      int  not null default 0 check (stock_quantity >= 0),  -- used when the product has no variants
  low_stock_threshold int  not null default 5 check (low_stock_threshold >= 0),
  seo_title           text,
  seo_description     text,
  og_image_url        text,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint products_compare_gt_price check (compare_at_price is null or compare_at_price >= price)
);
create index if not exists products_status_idx on public.products (status, created_at desc);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  key            text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null,
  name_ar        text,
  color_hex      text check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$'),
  sku            text unique,
  price_override int check (price_override is null or price_override >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  is_available   boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, key)
);
create trigger variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete set null,
  url          text not null,
  storage_path text,                 -- set when the file lives in the product-images bucket
  alt          text not null default '',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

create table if not exists public.product_categories (
  product_id  uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,  -- blocks deleting a non-empty category
  primary key (product_id, category_id)
);
create index if not exists product_categories_cat_idx on public.product_categories (category_id);

-- ------------------------------------------------------------
-- Inventory ledger
-- ------------------------------------------------------------
create table if not exists public.inventory_movements (
  id              bigint generated always as identity primary key,
  product_id      uuid not null references public.products(id) on delete cascade,
  variant_id      uuid references public.product_variants(id) on delete set null,
  delta           int  not null check (delta <> 0),
  quantity_after  int  not null check (quantity_after >= 0),
  reason          text not null check (reason in ('initial','restock','correction','damage','return','order_placed','order_cancelled','order_returned')),
  note            text,
  order_id        uuid,
  created_by      uuid,
  created_at      timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ------------------------------------------------------------
-- Customers, discounts, shipping
-- ------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique,
  name           text not null,
  email          text,
  wilaya_code    text,
  wilaya_name    text,
  notes          text,
  tags           text[] not null default '{}',
  first_order_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

create table if not exists public.discounts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  type          text not null check (type in ('percent', 'fixed')),
  value         int  not null check (value > 0),
  min_subtotal  int  not null default 0 check (min_subtotal >= 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  usage_limit   int check (usage_limit is null or usage_limit > 0),
  used_count    int  not null default 0 check (used_count >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint discounts_percent_range check (type <> 'percent' or value <= 100),
  constraint discounts_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create unique index if not exists discounts_code_uidx on public.discounts (code);
create trigger discounts_updated before update on public.discounts
  for each row execute function public.set_updated_at();

create table if not exists public.shipping_rates (
  wilaya_code   text primary key,
  home_fee      int not null default 0 check (home_fee >= 0),
  stopdesk_fee  int not null default 0 check (stopdesk_fee >= 0),
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Orders: extend (backward compatible)
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists subtotal        int,
  add column if not exists discount_amount int not null default 0 check (discount_amount >= 0),
  add column if not exists discount_code   text,
  add column if not exists shipping_fee    int not null default 0 check (shipping_fee >= 0),
  add column if not exists payment_method  text not null default 'cod',
  add column if not exists customer_id     uuid references public.customers(id) on delete set null,
  add column if not exists product_ref     uuid references public.products(id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists stock_released  boolean not null default false;

update public.orders set subtotal = unit_price * quantity where subtotal is null;

create unique index if not exists orders_idempotency_uidx on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_customer_idx on public.orders (customer_id);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'));

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_ref   uuid references public.products(id) on delete set null,
  variant_ref   uuid references public.product_variants(id) on delete set null,
  product_name  text not null,
  variant_name  text,
  sku           text,
  quantity      int not null check (quantity > 0),
  unit_price    int not null check (unit_price >= 0),
  line_total    int not null check (line_total >= 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table if not exists public.order_notes (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  author_id  uuid,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists order_notes_order_idx on public.order_notes (order_id, created_at);

-- Backfill: customers + items + history for pre-existing orders (idempotent).
insert into public.customers (phone, name, wilaya_code, wilaya_name, first_order_at)
select distinct on (phone) phone, customer_name, wilaya_code, wilaya_name, created_at
from public.orders
order by phone, created_at asc
on conflict (phone) do nothing;

update public.orders o set customer_id = c.id
from public.customers c where c.phone = o.phone and o.customer_id is null;

insert into public.order_items (order_id, product_name, variant_name, quantity, unit_price, line_total)
select o.id, o.product_name, o.variant_name, o.quantity, o.unit_price, o.unit_price * o.quantity
from public.orders o
where not exists (select 1 from public.order_items i where i.order_id = o.id);

insert into public.order_status_history (order_id, from_status, to_status, note, created_at)
select o.id, null, o.status, 'Backfill (historique antérieur à la migration)', o.created_at
from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);

-- ------------------------------------------------------------
-- Store settings, editable content, tracking, analytics events
-- ------------------------------------------------------------
create table if not exists public.store_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.content_sections (
  id          uuid primary key default gen_random_uuid(),
  page        text not null default 'home',
  section_key text not null,
  sort_order  int  not null default 0,
  is_visible  boolean not null default true,
  content     jsonb not null default '{}'::jsonb,   -- { fr: {...}, ar: {...} }
  updated_at  timestamptz not null default now(),
  unique (page, section_key)
);

-- Only validated identifiers and predefined toggles — never free-form JavaScript.
create table if not exists public.tracking_integrations (
  provider    text primary key check (provider in ('meta_pixel', 'ga4', 'google_ads', 'tiktok_pixel')),
  enabled     boolean not null default false,
  public_id   text,
  config      jsonb not null default '{}'::jsonb,   -- predefined event toggles, e.g. {"events":{"ViewContent":true}}
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  constraint tracking_id_format check (
    public_id is null or
    (provider = 'meta_pixel'   and public_id ~ '^[0-9]{10,20}$') or
    (provider = 'ga4'          and public_id ~ '^G-[A-Z0-9]{6,12}$') or
    (provider = 'google_ads'   and public_id ~ '^AW-[0-9]{6,14}$') or
    (provider = 'tiktok_pixel' and public_id ~ '^[A-Z0-9]{10,30}$')
  ),
  constraint tracking_enabled_needs_id check (not enabled or public_id is not null)
);

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  event_name   text not null check (event_name in ('PageView','ViewContent','Search','AddToCart','RemoveFromCart','InitiateCheckout','Lead','Purchase')),
  session_id   text,
  product_ref  uuid references public.products(id) on delete set null,
  order_id     uuid references public.orders(id) on delete set null,
  value        int,
  currency     text,
  path         text,
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  occurred_at  timestamptz not null default now()
);
create index if not exists analytics_events_time_idx on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_name_idx on public.analytics_events (event_name, occurred_at desc);

-- ------------------------------------------------------------
-- RLS — enabled everywhere; explicit policies only.
-- ------------------------------------------------------------
-- Drop any legacy/manual policy on orders (see docs/AUDIT.md §2.3).
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'orders' loop
    execute format('drop policy %I on public.orders', r.policyname);
  end loop;
end $$;

alter table public.admin_users            enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_variants       enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_categories     enable row level security;
alter table public.inventory_movements    enable row level security;
alter table public.customers              enable row level security;
alter table public.discounts              enable row level security;
alter table public.shipping_rates         enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_status_history   enable row level security;
alter table public.order_notes            enable row level security;
alter table public.store_settings         enable row level security;
alter table public.content_sections       enable row level security;
alter table public.tracking_integrations  enable row level security;
alter table public.analytics_events       enable row level security;

-- admin_users: a person sees their own row; owners manage the team.
create policy admin_users_self_read on public.admin_users for select to authenticated
  using (user_id = auth.uid() or public.has_role(array['owner']::public.admin_role[]));
create policy admin_users_owner_write on public.admin_users for all to authenticated
  using (public.has_role(array['owner']::public.admin_role[]))
  with check (public.has_role(array['owner']::public.admin_role[]));

create policy audit_logs_owner_read on public.audit_logs for select to authenticated
  using (public.has_role(array['owner']::public.admin_role[]));

-- Public catalogue (read-only) + manager/owner writes.
create policy categories_public_read on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_staff_write on public.categories for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy products_public_read on public.products for select to anon, authenticated
  using (status = 'active' or public.is_admin());
create policy products_staff_write on public.products for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy variants_public_read on public.product_variants for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy variants_staff_write on public.product_variants for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy images_public_read on public.product_images for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy images_staff_write on public.product_images for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy product_categories_public_read on public.product_categories for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy product_categories_staff_write on public.product_categories for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

-- Inventory: staff read; writes only through admin_adjust_stock()/place_order().
create policy inventory_staff_read on public.inventory_movements for select to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]));

-- Customers / orders: any admin role reads; no direct writes (RPCs only).
create policy customers_admin_read on public.customers for select to authenticated using (public.is_admin());
create policy customers_staff_update on public.customers for update to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy orders_admin_read on public.orders for select to authenticated using (public.is_admin());
create policy order_items_admin_read on public.order_items for select to authenticated using (public.is_admin());
create policy order_history_admin_read on public.order_status_history for select to authenticated using (public.is_admin());
create policy order_notes_admin_read on public.order_notes for select to authenticated using (public.is_admin());
create policy order_notes_admin_insert on public.order_notes for insert to authenticated
  with check (public.is_admin() and author_id = auth.uid());

-- Discounts: staff only (customers validate through the server, never by reading the table).
create policy discounts_staff_all on public.discounts for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy shipping_public_read on public.shipping_rates for select to anon, authenticated
  using (is_active or public.is_admin());
create policy shipping_staff_write on public.shipping_rates for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy settings_public_read on public.store_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy settings_staff_write on public.store_settings for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy content_public_read on public.content_sections for select to anon, authenticated
  using (is_visible or public.is_admin());
create policy content_staff_write on public.content_sections for all to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]))
  with check (public.has_role(array['owner','manager']::public.admin_role[]));

create policy tracking_public_read on public.tracking_integrations for select to anon, authenticated
  using (enabled or public.is_admin());
create policy tracking_owner_write on public.tracking_integrations for all to authenticated
  using (public.has_role(array['owner']::public.admin_role[]))
  with check (public.has_role(array['owner']::public.admin_role[]));

-- Analytics events are inserted by the server (service role); admins read.
create policy analytics_admin_read on public.analytics_events for select to authenticated
  using (public.has_role(array['owner','manager']::public.admin_role[]));

-- ------------------------------------------------------------
-- RPC: adjust stock (admin)
-- ------------------------------------------------------------
create or replace function public.admin_adjust_stock(
  p_product_id uuid, p_variant_id uuid, p_delta int, p_reason text, p_note text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_after int;
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_delta = 0 then raise exception 'INVALID_DELTA'; end if;
  if p_reason not in ('restock','correction','damage','return','initial') then raise exception 'INVALID_REASON'; end if;

  if p_variant_id is not null then
    update public.product_variants set stock_quantity = stock_quantity + p_delta
      where id = p_variant_id and product_id = p_product_id and stock_quantity + p_delta >= 0
      returning stock_quantity into v_after;
  else
    update public.products set stock_quantity = stock_quantity + p_delta
      where id = p_product_id and stock_quantity + p_delta >= 0
      returning stock_quantity into v_after;
  end if;
  if v_after is null then raise exception 'INSUFFICIENT_STOCK_OR_NOT_FOUND'; end if;

  insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, note, created_by)
  values (p_product_id, p_variant_id, p_delta, v_after, p_reason, p_note, auth.uid());
  perform public.write_audit('stock.adjust', 'product', p_product_id::text,
    jsonb_build_object('variant_id', p_variant_id, 'delta', p_delta, 'reason', p_reason));
  return v_after;
end $$;
revoke all on function public.admin_adjust_stock(uuid, uuid, int, text, text) from public, anon;
grant execute on function public.admin_adjust_stock(uuid, uuid, int, text, text) to authenticated;

-- ------------------------------------------------------------
-- RPC: save product (atomic: product + variants + images + categories)
-- Stock of EXISTING variants/products is never overwritten here: it only
-- changes through admin_adjust_stock() so the ledger stays truthful.
-- ------------------------------------------------------------
create or replace function public.admin_save_product(p jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_is_new boolean := (nullif(p->>'id', '') is null);
  v_status text := coalesce(p->>'status', 'draft');
  v jsonb; v_vid uuid; v_keep_variants uuid[] := '{}'; v_map jsonb := '{}'::jsonb;
  img jsonb; v_img_variant uuid; v_initial int;
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_is_new then
    insert into public.products (slug, name, description, price, compare_at_price, sku, status, rating, benefits, translations,
      tags, delivery_available, track_inventory, stock_quantity, low_stock_threshold, seo_title, seo_description, og_image_url, published_at)
    values (p->>'slug', p->>'name', p->>'description', (p->>'price')::int, nullif(p->>'compare_at_price','')::int,
      nullif(p->>'sku',''), v_status, nullif(p->>'rating','')::numeric, coalesce(p->'benefits','[]'), coalesce(p->'translations','{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p->'tags','[]'))), '{}'),
      coalesce((p->>'delivery_available')::boolean, true), coalesce((p->>'track_inventory')::boolean, true),
      0, coalesce((p->>'low_stock_threshold')::int, 5), nullif(p->>'seo_title',''), nullif(p->>'seo_description',''),
      nullif(p->>'og_image_url',''), case when v_status = 'active' then now() end)
    returning id into v_id;
  else
    update public.products set
      slug = p->>'slug', name = p->>'name', description = p->>'description',
      price = (p->>'price')::int, compare_at_price = nullif(p->>'compare_at_price','')::int,
      sku = nullif(p->>'sku',''), status = v_status, rating = nullif(p->>'rating','')::numeric,
      benefits = coalesce(p->'benefits','[]'), translations = coalesce(p->'translations','{}'),
      tags = coalesce(array(select jsonb_array_elements_text(coalesce(p->'tags','[]'))), '{}'),
      delivery_available = coalesce((p->>'delivery_available')::boolean, true),
      track_inventory = coalesce((p->>'track_inventory')::boolean, true),
      low_stock_threshold = coalesce((p->>'low_stock_threshold')::int, 5),
      seo_title = nullif(p->>'seo_title',''), seo_description = nullif(p->>'seo_description',''),
      og_image_url = nullif(p->>'og_image_url',''),
      published_at = case when v_status = 'active' then coalesce(published_at, now()) else published_at end
    where id = v_id;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  end if;

  -- Variants: upsert by id, delete the ones removed from the form.
  for v in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) loop
    v_vid := nullif(v->>'id', '')::uuid;
    v_initial := coalesce((v->>'stock_quantity')::int, 0);
    if v_vid is null or not exists (select 1 from public.product_variants where id = v_vid and product_id = v_id) then
      insert into public.product_variants (product_id, key, name, name_ar, color_hex, sku, price_override, stock_quantity, is_available, sort_order)
      values (v_id, v->>'key', v->>'name', nullif(v->>'name_ar',''), nullif(v->>'color_hex',''), nullif(v->>'sku',''),
        nullif(v->>'price_override','')::int, v_initial, coalesce((v->>'is_available')::boolean, true), coalesce((v->>'sort_order')::int, 0))
      returning id into v_vid;
      if v_initial > 0 then
        insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, created_by)
        values (v_id, v_vid, v_initial, v_initial, 'initial', auth.uid());
      end if;
    else
      update public.product_variants set key = v->>'key', name = v->>'name', name_ar = nullif(v->>'name_ar',''),
        color_hex = nullif(v->>'color_hex',''), sku = nullif(v->>'sku',''), price_override = nullif(v->>'price_override','')::int,
        is_available = coalesce((v->>'is_available')::boolean, true), sort_order = coalesce((v->>'sort_order')::int, 0)
      where id = v_vid;
    end if;
    v_keep_variants := v_keep_variants || v_vid;
    if v ? 'client_key' then v_map := v_map || jsonb_build_object(v->>'client_key', v_vid::text); end if;
  end loop;
  delete from public.product_variants where product_id = v_id and not (id = any (v_keep_variants));

  -- Product-level initial stock (new products without variants).
  if v_is_new and coalesce(jsonb_array_length(p->'variants'), 0) = 0 and coalesce((p->>'stock_quantity')::int, 0) > 0 then
    update public.products set stock_quantity = (p->>'stock_quantity')::int where id = v_id;
    insert into public.inventory_movements (product_id, delta, quantity_after, reason, created_by)
    values (v_id, (p->>'stock_quantity')::int, (p->>'stock_quantity')::int, 'initial', auth.uid());
  end if;

  -- Images: replace the set (files are removed from Storage by the app layer).
  delete from public.product_images where product_id = v_id;
  for img in select * from jsonb_array_elements(coalesce(p->'images', '[]'::jsonb)) loop
    v_img_variant := null;
    if nullif(img->>'variant_id','') is not null then
      v_img_variant := (img->>'variant_id')::uuid;
    elsif nullif(img->>'variant_client_key','') is not null then
      v_img_variant := nullif(v_map->>(img->>'variant_client_key'), '')::uuid;
    end if;
    insert into public.product_images (product_id, variant_id, url, storage_path, alt, sort_order)
    values (v_id, v_img_variant, img->>'url', nullif(img->>'storage_path',''), coalesce(img->>'alt',''), coalesce((img->>'sort_order')::int, 0));
  end loop;

  -- Categories.
  delete from public.product_categories where product_id = v_id;
  insert into public.product_categories (product_id, category_id)
  select v_id, x::uuid from jsonb_array_elements_text(coalesce(p->'category_ids', '[]'::jsonb)) x;

  perform public.write_audit(case when v_is_new then 'product.create' else 'product.update' end, 'product', v_id::text,
    jsonb_build_object('name', p->>'name', 'status', v_status));
  return v_id;
end $$;
revoke all on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- ------------------------------------------------------------
-- RPC: order status transitions (controlled) + restock on cancel/return
-- ------------------------------------------------------------
create or replace function public.order_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case p_from
    when 'new'        then p_to in ('confirmed', 'cancelled')
    when 'confirmed'  then p_to in ('processing', 'cancelled')
    when 'processing' then p_to in ('shipped', 'cancelled')
    when 'shipped'    then p_to in ('delivered', 'returned')
    when 'delivered'  then p_to in ('returned')
    else false
  end
$$;

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

  -- Give the stock back exactly once when an order is cancelled or returned.
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

  update public.orders set status = p_to, updated_at = now() where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (o.id, o.status, p_to, auth.uid(), p_note);
  perform public.write_audit('order.status', 'order', o.id::text, jsonb_build_object('from', o.status, 'to', p_to));
  return p_to;
end $$;
revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- RPC: place order (atomic). Callable ONLY by the server (service role).
-- Prices, stock, discount and shipping are all resolved here.
-- ------------------------------------------------------------
create or replace function public.place_order(
  p_product_id uuid, p_variant_id uuid, p_quantity int,
  p_customer_name text, p_phone text, p_wilaya_code text, p_wilaya_name text,
  p_delivery_type text, p_commune text, p_address text, p_stopdesk text,
  p_discount_code text, p_attribution jsonb, p_idempotency_key text
) returns table (order_id uuid, order_number text, total_price int, replayed boolean)
language plpgsql security definer set search_path = public as $$
declare
  pr public.products%rowtype; va public.product_variants%rowtype;
  v_unit int; v_subtotal int; v_discount int := 0; v_ship int := 0; v_total int;
  v_customer uuid; v_order uuid; v_number text; v_after int; d public.discounts%rowtype;
  v_code text := nullif(upper(trim(coalesce(p_discount_code, ''))), '');
begin
  -- Idempotency: the same key returns the same order instead of creating another.
  if p_idempotency_key is not null then
    select o.id, o.order_number, o.total_price into v_order, v_number, v_total
    from public.orders o where o.idempotency_key = p_idempotency_key;
    if found then
      return query select v_order, v_number, v_total, true; return;
    end if;
  end if;

  if p_quantity < 1 or p_quantity > 10 then raise exception 'INVALID_QUANTITY'; end if;
  select * into pr from public.products where id = p_product_id and status = 'active' and delivery_available;
  if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;

  if exists (select 1 from public.product_variants where product_id = pr.id) then
    if p_variant_id is null then raise exception 'VARIANT_REQUIRED'; end if;
    select * into va from public.product_variants where id = p_variant_id and product_id = pr.id;
    if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
    if not va.is_available then raise exception 'VARIANT_UNAVAILABLE'; end if;
    v_unit := coalesce(va.price_override, pr.price);
    if pr.track_inventory then
      update public.product_variants set stock_quantity = stock_quantity - p_quantity
        where id = va.id and stock_quantity >= p_quantity returning stock_quantity into v_after;
      if v_after is null then raise exception 'OUT_OF_STOCK'; end if;
    end if;
  else
    v_unit := pr.price;
    if pr.track_inventory then
      update public.products set stock_quantity = stock_quantity - p_quantity
        where id = pr.id and stock_quantity >= p_quantity returning stock_quantity into v_after;
      if v_after is null then raise exception 'OUT_OF_STOCK'; end if;
    end if;
  end if;

  v_subtotal := v_unit * p_quantity;

  if v_code is not null then
    select * into d from public.discounts where code = v_code for update;
    if not found or not d.is_active
       or (d.starts_at is not null and d.starts_at > now())
       or (d.ends_at is not null and d.ends_at < now())
       or (d.usage_limit is not null and d.used_count >= d.usage_limit)
       or v_subtotal < d.min_subtotal then
      raise exception 'DISCOUNT_INVALID';
    end if;
    v_discount := least(v_subtotal, case d.type when 'percent' then (v_subtotal * d.value) / 100 else d.value end);
    update public.discounts set used_count = used_count + 1 where id = d.id;
  end if;

  select case when p_delivery_type = 'home' then home_fee else stopdesk_fee end into v_ship
  from public.shipping_rates where wilaya_code = p_wilaya_code and is_active;
  v_ship := coalesce(v_ship, 0);

  v_total := v_subtotal - v_discount + v_ship;
  if v_total <= 0 then raise exception 'INVALID_TOTAL'; end if;

  insert into public.customers (phone, name, wilaya_code, wilaya_name, first_order_at)
  values (p_phone, p_customer_name, p_wilaya_code, p_wilaya_name, now())
  on conflict (phone) do update set name = excluded.name, wilaya_code = excluded.wilaya_code, wilaya_name = excluded.wilaya_name
  returning id into v_customer;

  insert into public.orders (
    product_id, product_name, variant_id, variant_name, quantity, unit_price, total_price, currency,
    customer_name, phone, wilaya_code, wilaya_name, delivery_type, commune, address, stopdesk,
    utm_source, utm_medium, utm_campaign, utm_content, fbclid,
    subtotal, discount_amount, discount_code, shipping_fee, customer_id, product_ref, idempotency_key
  ) values (
    pr.slug, pr.name, va.key, va.name, p_quantity, v_unit, v_total, pr.currency,
    p_customer_name, p_phone, p_wilaya_code, p_wilaya_name, p_delivery_type,
    case when p_delivery_type = 'home' then p_commune end,
    case when p_delivery_type = 'home' then p_address end,
    case when p_delivery_type = 'stopdesk' then p_stopdesk end,
    p_attribution->>'utm_source', p_attribution->>'utm_medium', p_attribution->>'utm_campaign',
    p_attribution->>'utm_content', p_attribution->>'fbclid',
    v_subtotal, v_discount, v_code, v_ship, v_customer, pr.id, p_idempotency_key
  ) returning id, orders.order_number into v_order, v_number;

  insert into public.order_items (order_id, product_ref, variant_ref, product_name, variant_name, sku, quantity, unit_price, line_total)
  values (v_order, pr.id, va.id, pr.name, va.name, coalesce(va.sku, pr.sku), p_quantity, v_unit, v_subtotal);

  insert into public.order_status_history (order_id, from_status, to_status, note) values (v_order, null, 'new', 'Commande créée');

  if v_after is not null then
    insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, order_id)
    values (pr.id, va.id, -p_quantity, v_after, 'order_placed', v_order);
  end if;

  return query select v_order, v_number, v_total, false;
end $$;
revoke all on function public.place_order(uuid, uuid, int, text, text, text, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, int, text, text, text, text, text, text, text, text, text, jsonb, text) to service_role;

-- ------------------------------------------------------------
-- Storage buckets + policies (public read, staff write)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('store-assets',   'store-assets',   true, 5242880, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml','image/x-icon'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_media_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'store-assets'));
create policy storage_media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'store-assets') and public.has_role(array['owner','manager']::public.admin_role[]));
create policy storage_media_staff_update on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'store-assets') and public.has_role(array['owner','manager']::public.admin_role[]));
create policy storage_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'store-assets') and public.has_role(array['owner','manager']::public.admin_role[]));

-- ------------------------------------------------------------
-- RPC: product status (single or bulk), delete, export audit
-- ------------------------------------------------------------
create or replace function public.admin_set_products_status(p_ids uuid[], p_status text)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'active', 'archived') then raise exception 'INVALID_STATUS'; end if;
  update public.products
     set status = p_status,
         published_at = case when p_status = 'active' then coalesce(published_at, now()) else published_at end
   where id = any (p_ids);
  get diagnostics n = row_count;
  perform public.write_audit('product.status', 'product', null, jsonb_build_object('ids', p_ids, 'status', p_status));
  return n;
end $$;
revoke all on function public.admin_set_products_status(uuid[], text) from public, anon;
grant execute on function public.admin_set_products_status(uuid[], text) to authenticated;

-- Returns the Storage paths to delete (the app layer removes the files afterwards).
create or replace function public.admin_delete_product(p_id uuid)
returns text[]
language plpgsql security definer set search_path = public as $$
declare v_paths text[]; v_name text;
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select name into v_name from public.products where id = p_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}')
    into v_paths from public.product_images where product_id = p_id;
  delete from public.products where id = p_id;   -- orders keep their snapshot (product_ref -> null)
  perform public.write_audit('product.delete', 'product', p_id::text, jsonb_build_object('name', v_name));
  return v_paths;
end $$;
revoke all on function public.admin_delete_product(uuid) from public, anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;

create or replace function public.admin_log_export(p_entity text, p_rows int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['owner','manager']::public.admin_role[]) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform public.write_audit('export', p_entity, null, jsonb_build_object('rows', p_rows));
end $$;
revoke all on function public.admin_log_export(text, int) from public, anon;
grant execute on function public.admin_log_export(text, int) to authenticated;

-- ------------------------------------------------------------
-- Generic row-level audit for configuration tables.
-- ------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pk text := tg_argv[0]; v_row jsonb; v_changed text[];
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_op = 'UPDATE' then
    select array_agg(k) into v_changed
    from jsonb_object_keys(to_jsonb(new)) k
    where to_jsonb(new)->k is distinct from to_jsonb(old)->k and k <> 'updated_at';
    if v_changed is null then return new; end if;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, details)
  values (auth.uid(), public.current_admin_role()::text, lower(tg_op), tg_table_name, v_row->>v_pk,
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.audit_row_change('id');
create trigger audit_discounts  after insert or update or delete on public.discounts  for each row execute function public.audit_row_change('id');
create trigger audit_settings   after insert or update or delete on public.store_settings for each row execute function public.audit_row_change('key');
create trigger audit_tracking   after insert or update or delete on public.tracking_integrations for each row execute function public.audit_row_change('provider');
create trigger audit_admins     after insert or update or delete on public.admin_users for each row execute function public.audit_row_change('user_id');
create trigger audit_shipping   after insert or update or delete on public.shipping_rates for each row execute function public.audit_row_change('wilaya_code');
