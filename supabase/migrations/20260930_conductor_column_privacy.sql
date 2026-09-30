-- Conductors can read their own fares, but not the passenger's full phone
-- number or the full M-Pesa receipt. RLS limits which rows they see; these
-- column grants limit which fields. Realtime drops columns the subscriber
-- can't select, so the live feed stops carrying them too.
-- A full receipt typed into dashboard search is matched server-side by
-- /api/dashboard/search with the service role instead.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

revoke select on transactions from anon, authenticated;
grant select (
  id, vehicle_id, amount_kes, phone_last3, receipt_last3, status,
  verified_by_conductor, verified_at, source, created_at, completed_at
) on transactions to authenticated;
