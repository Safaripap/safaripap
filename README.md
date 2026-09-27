# Matatu Lightning Payments

Bitcoin Lightning fare payments for Kenyan matatus, settled instantly from an ordinary M-Pesa payment — built for **Hack4Freedom** (Dada Devs hackathon), demo day October 5, 2026.

## What this is

A passenger pays a normal M-Pesa fare from their phone. Bitika settles that payment as Bitcoin over the Lightning Network, straight into that specific vehicle's own Lightning wallet, in real time. The conductor sees the fare land on a live dashboard, and every successful payment publishes a public receipt event to Nostr for transparency.

## How it works

1. The passenger opens a link for a specific vehicle (`/pay/<vehicleCode>`) — from a QR code — or dials a USSD code (`*XXX#`) on any phone, including feature phones with no internet.
2. They enter the fare and their M-Pesa number.
3. The app calls Bitika's `/collect` endpoint. Bitika triggers the M-Pesa STK push, receives the KES payment, converts it, and forwards it as sats to the vehicle's own Lightning address (hosted on our LNbits instance).
4. Bitika sends signed webhooks as the payment progresses (`processing_payment` to `fulfilled`, or `failed` / `payment_failed` on decline). Our server verifies the HMAC signature on every webhook before trusting it, and updates the transaction in Supabase.
5. The conductor's dashboard (`/dashboard/<vehicleCode>`) updates live via Supabase Realtime — no refresh needed.
6. On a successful payment, a receipt event is published to Nostr relays, giving a public, tamper-evident record of the fare.

## Tech stack

- **Next.js 14** (App Router) + TypeScript + Tailwind — passenger PWA, conductor dashboard, and all API routes
- **Supabase** (Postgres + Realtime) — saccos / vehicles / transactions data, and the live dashboard feed
- **Bitika** ([bitika.xyz](https://bitika.xyz)) — the M-Pesa to Lightning payment bridge
- **LNbits** — one Lightning wallet plus Lightning Address per vehicle
- **Nostr** — public payment receipt events
- **Africa's Talking** — USSD channel, for passengers without smartphones

## Repo structure

    src/
      app/
        pay/[vehicleCode]/page.tsx        passenger PWA
        dashboard/[vehicleCode]/page.tsx  conductor dashboard (Supabase Realtime)
        api/
          pay/route.ts                    PWA payment initiation
          ussd/route.ts                   Africa's Talking USSD webhook
          webhooks/bitika/route.ts        Bitika payment status webhook (signature-verified)
          transactions/[code]/route.ts    status polling for the PWA
          vehicles/[code]/route.ts        vehicle lookup
      lib/
        bitika.ts                         Bitika API client
        supabase-admin.ts                 server-side Supabase client (service role)
        supabase-browser.ts               browser Supabase client (anon key)
        phone.ts                          Kenyan phone number normalization (07/01/254 to 254)
        nostr.ts                          Nostr receipt publishing
    supabase/
      schema.sql                          full DB schema, run in the Supabase SQL editor

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | full-access key, never exposed to the browser |
| `BITIKA_API_KEY` | server only | from the Bitika developer portal |
| `BITIKA_WEBHOOK_SECRET` | server only | signing secret for the currently registered webhook endpoint, regenerates if you edit or re-add the endpoint |

Never commit `.env`. It's in `.gitignore` — double check before every push to this repo.

## Local setup

1. `npm install`
2. Create `.env` with the variables above.
3. Run `supabase/schema.sql` in your Supabase project's SQL editor, then enable Realtime on the `transactions` table (Database, Replication).
4. In LNbits, create a wallet plus an LNURLp pay link (variable amount) per vehicle to get its Lightning Address.
5. Insert a `saccos` row and a `vehicles` row per vehicle in Supabase, including its `lnbits_wallet_id`, `lnbits_invoice_key`, and `lightning_address`.
6. Run `npm run dev`, then in a second terminal `ngrok http 3000`.
7. On the Bitika dashboard, register a webhook endpoint at `<ngrok-url>/api/webhooks/bitika` and copy the signing secret it gives you into `.env` as `BITIKA_WEBHOOK_SECRET`.
8. On Africa's Talking, point your sandbox USSD channel's callback at `<ngrok-url>/api/ussd`.

## Current status

Confirmed working end-to-end in Bitika's sandbox: the passenger PWA payment flow, including phone numbers entered as 07, 01, or 254 formats; Bitika webhook delivery with HMAC signature verification across all three outcomes (success, M-Pesa decline, Lightning payout failure); the live conductor dashboard via Supabase Realtime with no refresh needed; Nostr receipt publishing on successful payments, done non-blocking so a slow relay never delays the webhook response; and per-vehicle LNbits wallets and Lightning Addresses.

Not yet done: the USSD flow has not been tested end-to-end against the Africa's Talking sandbox simulator; there is no landing page yet; the PWA and dashboard are functional but undesigned; and the live Bitika key is pending approval, which is required before demo day since the sandbox never moves real money.

## Team

Built for Hack4Freedom by Dada Devs. See the team for current task ownership.
