-- Tighter Nostr record (see src/lib/nostr-events.ts).
-- transactions.nostr_event_id: the fare's published Nostr event, so a fare
-- whose event never reached a relay is found and published again.
-- nostr_reports: the signed daily report per vehicle (ported from Nauli
-- Sacco), with the hash of the fare list it was signed over.
-- Server only: RLS on, no policies, and nostr_event_id isn't granted to
-- conductors.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

alter table transactions add column if not exists nostr_event_id text;

create table if not exists nostr_reports (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  report_date date not null,
  event_id text not null,
  content_hash text not null,
  fares integer not null,
  kes integer not null,
  sats integer not null,
  created_at timestamptz default now(),
  unique (vehicle_id, report_date)
);

alter table nostr_reports enable row level security;
