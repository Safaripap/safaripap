-- Daraja STK push fallback + treasury settlement, ported from Nauli Sacco.
-- When Bitika can't start a payment, /api/pay sends a Daraja STK push
-- instead. Those fares land in the M-Pesa paybill, and once Daraja confirms
-- them the pre-funded LNbits treasury wallet pays the vehicle's wallet the
-- equivalent sats (src/lib/treasury.ts). A settled fare keeps status
-- 'fulfilled'; settled_at records the settlement.
-- None of these columns are granted to conductors (authenticated), so the
-- dashboard and Realtime never carry them.
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

alter table transactions add column if not exists daraja_checkout_id text unique;
alter table transactions add column if not exists daraja_merchant_request_id text;
alter table transactions add column if not exists failure_reason text;
alter table transactions add column if not exists amount_sats integer;
alter table transactions add column if not exists btc_kes_rate numeric;
alter table transactions add column if not exists ln_payment_hash text;
alter table transactions add column if not exists settled_at timestamptz;
