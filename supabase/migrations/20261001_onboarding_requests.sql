-- Requests from saccos and matatu owners who want to join Safaripap, sent from
-- the public /join form. Staff review them in /admin/requests and onboard from
-- there. Only the server (service role) reads or writes this table: RLS is on
-- with no policies, so the anon and authenticated roles can't touch it.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

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
