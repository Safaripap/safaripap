-- Matatu Lightning Payments — Supabase schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create table saccos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references saccos(id),
  vehicle_code text unique not null,        -- short human code, e.g. "KAB123B"
  conductor_name text,
  preset_fare_kes integer,                  -- null if conductor sets amount per trip
  lnbits_wallet_id text not null,
  lnbits_invoice_key text not null,         -- read-only key, used for status checks
  lightning_address text not null,          -- passed to Bitika as `lightningAddress`
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  amount_kes integer not null,
  payer_phone text not null,                -- 254XXXXXXXXX
  phone_last3 text generated always as (right(payer_phone, 3)) stored,
  bitika_transaction_code text unique,
  mpesa_receipt text,
  receipt_last3 text generated always as (right(coalesce(mpesa_receipt, ''), 3)) stored,
  status text not null default 'processing', -- processing | processing_payment | fulfilled | failed
  verified_by_conductor boolean default false,
  verified_at timestamptz,
  source text not null,                     -- 'pwa' | 'ussd'
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index transactions_vehicle_created_idx on transactions (vehicle_id, created_at desc);
create index transactions_phone_last3_idx on transactions (vehicle_id, phone_last3);
create index transactions_receipt_last3_idx on transactions (vehicle_id, receipt_last3);

-- Enable Realtime on transactions so the conductor dashboard gets inserts/updates live.
-- (In the Supabase dashboard: Database -> Replication -> toggle `transactions` on,
-- or run this if your project already has the publication.)
alter publication supabase_realtime add table transactions;

-- Row Level Security: locked down by default. For the hackathon, either:
--   a) do writes only from the server (service role key) and reads from the dashboard
--      via a permissive SELECT policy scoped by vehicle_id, or
--   b) turn RLS off on these tables entirely for speed, and lock it down after judging.
-- Option (a), minimal version:
alter table transactions enable row level security;
create policy "public can read transactions" on transactions for select using (true);
alter table vehicles enable row level security;
create policy "public can read vehicles" on vehicles for select using (true);
