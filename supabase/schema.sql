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
  conductor_user_id uuid references auth.users(id), -- Supabase Auth login for this vehicle's conductor
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

-- Row Level Security: all writes go through the server (service role key, which
-- bypasses RLS). The browser only reads, and only as a logged-in conductor,
-- scoped to the vehicle they're linked to via vehicles.conductor_user_id.
alter table transactions enable row level security;
alter table vehicles enable row level security;
alter table saccos enable row level security;

create index vehicles_conductor_user_idx on vehicles (conductor_user_id);

create policy "conductor reads own vehicle" on vehicles
  for select to authenticated
  using (conductor_user_id = auth.uid());

create policy "conductor reads own transactions" on transactions
  for select to authenticated
  using (exists (
    select 1 from vehicles v
    where v.id = transactions.vehicle_id and v.conductor_user_id = auth.uid()
  ));

-- Conductors can mark their own fares as verified, and change nothing else.
revoke update on transactions from anon, authenticated;
grant update (verified_by_conductor, verified_at) on transactions to authenticated;

create policy "conductor verifies own transactions" on transactions
  for update to authenticated
  using (exists (
    select 1 from vehicles v
    where v.id = transactions.vehicle_id and v.conductor_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from vehicles v
    where v.id = transactions.vehicle_id and v.conductor_user_id = auth.uid()
  ));
