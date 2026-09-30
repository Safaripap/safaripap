-- Receipt ending: last 4 characters, not 3. With dozens of fares per vehicle
-- per day, 3 characters has a real chance of two receipts sharing an ending.
-- The pay screen tells passengers the last 4, so the dashboard must match.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

alter table transactions
  add column if not exists receipt_last4 text
  generated always as (right(coalesce(mpesa_receipt, ''), 4)) stored;

create index if not exists transactions_receipt_last4_idx on transactions (vehicle_id, receipt_last4);
