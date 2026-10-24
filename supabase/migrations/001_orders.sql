-- ============================================================
-- COD Store — orders table
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- ============================================================

create sequence if not exists order_number_seq start with 1;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'CMD-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$;

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default public.generate_order_number(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  product_id           text not null,
  product_name         text not null,
  variant_id           text,
  variant_name         text,

  quantity             int  not null check (quantity > 0 and quantity <= 10),
  unit_price           int  not null check (unit_price > 0),
  total_price          int  not null check (total_price > 0),
  currency             text not null default 'DZD',

  customer_name        text not null,
  phone                text not null,

  wilaya_code          text not null,
  wilaya_name          text not null,

  delivery_type        text not null check (delivery_type in ('home', 'stopdesk')),
  commune              text,
  address              text,
  stopdesk             text,

  status               text not null default 'new'
                       check (status in ('new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),

  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  utm_content          text,
  fbclid               text,

  google_sheet_synced  boolean not null default false
);

create index if not exists orders_status_idx   on public.orders (status);
create index if not exists orders_created_idx  on public.orders (created_at desc);
create index if not exists orders_phone_idx    on public.orders (phone);

-- RLS: no policies = no direct access for anon/authenticated users.
-- The Next.js server (service role) bypasses RLS entirely.
alter table public.orders enable row level security;
