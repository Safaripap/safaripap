-- Sacco managers and matatu owners: people who sign in with their phone
-- number + PIN to see fare totals. A manager sees every vehicle in their
-- sacco; an owner sees only the vehicles linked to them in vehicle_owners.
-- Accounts are created from /admin/people. Dashboard data is served by API
-- routes that check the role server-side, so these tables only need to let a
-- member read their own rows.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

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
