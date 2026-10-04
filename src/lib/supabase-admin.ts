import { createClient } from '@supabase/supabase-js'

// Server-side client — uses the service role key, full access. Only ever
// imported from server-side files (API routes) — never from a 'use client' component.
//
// Every query opts out of Next.js's fetch cache. Next 14 caches GET fetches by
// default, and supabase-js reads are GET fetches, so without this a route like
// /api/transactions/[code] kept returning the first 'processing' it saw while
// the passenger's fare had long since been paid.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  }
)
