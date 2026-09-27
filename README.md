# Matatu Lightning Pay — hackathon scaffold

Companion code for the build plan doc. This runs, but three things need your
own values before it does anything real: Bitika API access, an LNbits hosted
account, and a Supabase project.

## What's ready to run
- Full Next.js 14 app structure, Tailwind, Framer Motion
- Passenger PWA (`/pay/[vehicleCode]`) — amount, phone, waiting, success states
- Conductor dashboard (`/dashboard/[vehicleCode]`) — live table via Supabase Realtime, tap-to-verify
- SACCO/owner view (`/sacco/[saccoId]`) — subscribes live to Nostr relays, sums totals
- API routes: `/api/pay`, `/api/ussd`, `/api/webhooks/bitika`, `/api/vehicles/[code]`, `/api/transactions/[code]`
- `supabase/schema.sql` — full schema + Realtime + basic RLS
- `scripts/onboard-vehicle.ts` — provisions an LNbits wallet + Lightning Address per vehicle
- `scripts/gen-nostr-key.mjs` — generates the app's Nostr keypair once

## What you still need to do
1. **Get a Bitika API key** and confirm the *exact* webhook payload shape and HMAC
   header name with their support (WhatsApp link on bitika.xyz) — the guessed
   field names in `src/app/api/webhooks/bitika/route.ts` need to be checked against
   a real payload. This is the single highest-risk unknown in the whole build —
   do it on day 1, not day 6.
2. **Create a Supabase project**, run `supabase/schema.sql` in its SQL editor, and
   enable Realtime on the `transactions` table if the `alter publication` line
   doesn't already cover it in your project.
3. **Create an LNbits account** on a hosted instance (e.g. `https://legend.lnbits.com`),
   grab your admin key + admin user id, then run:
   ```
   npm install
   cp .env.example .env   # fill in every value
   npx tsx scripts/onboard-vehicle.ts KAB123B "Conductor Name" <sacco-id> 50
   ```
   for each test vehicle (last argument is an optional preset fare in KES).
4. **Generate the Nostr keypair**: `node scripts/gen-nostr-key.mjs`, copy both
   printed lines into `.env`.
5. **Register an Africa's Talking sandbox app**, point its USSD callback URL at
   `https://<your-deployed-url>/api/ussd`, and test with their web simulator.
6. Add a real QR scanning library to the vehicle-code entry step if you want
   camera scanning rather than manual code entry (e.g. `html5-qrcode`) — not
   included here to keep the scaffold dependency-light.
7. Polish: loading/empty states, real vehicle icons, a proper logo, and a
   `manifest.json` icon set for the PWA (currently empty).

## Running locally
```
npm install
cp .env.example .env   # fill in every value
npm run dev
```

## Testing the smallest real end-to-end payment
Bitika's floor is KES 10; use a small real amount to your own number while testing —
there's no sandbox/testnet on either the Bitika or bitcoin.co.ke side, every call
moves real money.
