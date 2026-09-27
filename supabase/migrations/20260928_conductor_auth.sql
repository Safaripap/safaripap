-- Conductor auth: only a vehicle's own conductor can read its fares.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

-- Link each vehicle to the Supabase Auth user who conducts it.
alter table vehicles add column if not exists conductor_user_id uuid references auth.users(id);
create index if not exists vehicles_conductor_user_idx on vehicles (conductor_user_id);

-- Drop the old "anyone can read everything" policies. They exposed every
-- passenger's full phone number and every vehicle's LNbits keys to the anon key.
drop policy if exists "public can read transactions" on transactions;
drop policy if exists "public can read vehicles" on vehicles;

-- RLS may have been switched off on the live project for speed; turn it back on.
alter table transactions enable row level security;
alter table vehicles enable row level security;
alter table saccos enable row level security;

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
