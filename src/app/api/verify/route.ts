import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { dailyFares, isReportDate } from '@/lib/nostr-report'

// Public: a vehicle's paid fares for one Nairobi day, in the shape the signed
// Nostr report hashed (fare id, amount, last 3 receipt characters, status;
// no phone digits). /verify hashes this list in the browser and compares it
// with the hash in the report fetched straight from the relays.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const code = (q.get('vehicle') ?? '').replace(/\s+/g, '').toUpperCase()
  const date = q.get('date') ?? ''
  if (!/^[A-Z0-9]{3,12}$/.test(code) || !isReportDate(date)) {
    return NextResponse.json({ error: 'Give a vehicle code and a date (YYYY-MM-DD)' }, { status: 400 })
  }
  const { data: vehicle } = await supabaseAdmin
    .from('vehicles')
    .select('id, vehicle_code, is_demo')
    .eq('vehicle_code', code)
    .maybeSingle()
  if (!vehicle || vehicle.is_demo) return NextResponse.json({ error: `No vehicle ${code}` }, { status: 404 })

  const [{ fares }, { data: report }] = await Promise.all([
    dailyFares(vehicle.id, date),
    supabaseAdmin.from('nostr_reports').select('event_id, content_hash, created_at').eq('vehicle_id', vehicle.id).eq('report_date', date).maybeSingle(),
  ])
  return NextResponse.json(
    { vehicleCode: vehicle.vehicle_code, date, fares, report: report ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
