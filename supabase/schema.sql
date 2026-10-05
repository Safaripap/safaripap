-- Safaripap — Supabase schema
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
  is_demo boolean not null default false,   -- placeholder matatu from /admin/demo; never payable
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
  completed_at timestamptz,
  is_demo boolean not null default false,   -- generated demo fare
  -- Daraja STK push fallback (when Bitika fails) and treasury settlement
  daraja_checkout_id text unique,
  daraja_merchant_request_id text,
  failure_reason text,
  amount_sats integer,                      -- sats the treasury paid the vehicle
  btc_kes_rate numeric,
  ln_payment_hash text,                     -- treasury settlement claim
  settled_at timestamptz
);

create index transactions_vehicle_created_idx on transactions (vehicle_id, created_at desc);
create index transactions_phone_last3_idx on transactions (vehicle_id, phone_last3);
create index transactions_receipt_last3_idx on transactions (vehicle_id, receipt_last3);
create index transactions_demo_idx on transactions (vehicle_id) where is_demo;

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
-- Conductors see their own fares but never the full phone number or receipt.
revoke select on transactions from anon, authenticated;
grant select (
  id, vehicle_id, amount_kes, phone_last3, receipt_last3, status,
  verified_by_conductor, verified_at, source, created_at, completed_at
) on transactions to authenticated;

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

-- Sacco managers and matatu owners (phone + PIN sign-in). A manager sees every
-- vehicle in their sacco; an owner sees only the vehicles in vehicle_owners.
create table if not exists sacco_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sacco_id uuid not null references saccos(id) on delete cascade,
  role text not null check (role in ('manager', 'owner')),
  full_name text not null,
  phone text not null unique,               -- 254XXXXXXXXX
  created_at timestamptz default now()
);
create index if not exists sacco_members_sacco_idx on sacco_members (sacco_id);

create table if not exists vehicle_owners (
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  user_id uuid not null references sacco_members(user_id) on delete cascade,
  primary key (vehicle_id, user_id)
);
create index if not exists vehicle_owners_user_idx on vehicle_owners (user_id);

alter table sacco_members enable row level security;
alter table vehicle_owners enable row level security;

drop policy if exists "member reads own membership" on sacco_members;
create policy "member reads own membership" on sacco_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "owner reads own vehicle links" on vehicle_owners;
create policy "owner reads own vehicle links" on vehicle_owners
  for select to authenticated
  using (user_id = auth.uid());

-- Join requests from the public /join form, reviewed in /admin/requests.
create table if not exists onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  sacco_name text not null,
  contact_name text not null,
  phone text not null,                       -- 254XXXXXXXXX
  role text not null check (role in ('manager', 'owner')),
  matatu_count integer not null check (matatu_count between 1 and 500),
  plates text[] not null default '{}',
  notes text,
  status text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  created_at timestamptz default now(),
  handled_at timestamptz
);
create index if not exists onboarding_requests_status_idx on onboarding_requests (status, created_at desc);

alter table onboarding_requests enable row level security;
