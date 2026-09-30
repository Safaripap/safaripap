-- Demo data: placeholder matatus with generated fare history, so the sacco
-- dashboard looks lived-in on demo day. Generated and cleared from
-- /admin/demo. Demo vehicles can never take real payments (the pay API and
-- USSD refuse them, and their Lightning Address is on an invalid domain), and
-- the manager dashboard labels them "Demo".
-- Run this once in the Supabase SQL editor on an existing project.
-- Fresh projects get the same result from supabase/schema.sql.

alter table vehicles add column if not exists is_demo boolean not null default false;
alter table transactions add column if not exists is_demo boolean not null default false;
create index if not exists transactions_demo_idx on transactions (vehicle_id) where is_demo;
