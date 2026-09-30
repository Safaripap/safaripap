import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { memberFromRequest } from '@/lib/member-auth'
import {
  addDays,
  aggregate,
  dayKey,
  previousPeriod,
  rangeBounds,
  toCsv,
  validateRange,
  type FareRow,
} from '@/lib/insights'

const PAGE = 1000 // PostgREST's default row cap per request
const MAX_ROWS = 50_000

// Fare metrics for the signed-in manager (whole sacco) or owner (their
// matatus). ?from=YYYY-MM-DD&to=YYYY-MM-DD (Nairobi days, default last 7),
// optional &vehicle=<id> to narrow to one matatu in scope, &format=csv for a
// spreadsheet. Only paid fares count.
export async function GET(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })

  const q = req.nextUrl.searchParams
  const today = dayKey(Date.now())
  const to = q.get('to') ?? today
  const from = q.get('from') ?? addDays(to, -6)
  const invalid = validateRange(from, to)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const vehicleParam = q.get('vehicle')
  const vehicles = vehicleParam ? member.vehicles.filter((v) => v.id === vehicleParam) : member.vehicles
  if (vehicleParam && vehicles.length === 0) {
    return NextResponse.json({ error: 'That matatu isn’t one you can see' }, { status: 403 })
  }

  // One query covering the previous period and this one.
  const { start } = rangeBounds(previousPeriod(from, to).from, to)
  const { end } = rangeBounds(from, to)
  const rows: FareRow[] = []
  if (vehicles.length) {
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('vehicle_id, amount_kes, created_at')
        .in(
          'vehicle_id',
          vehicles.map((v) => v.id)
        )
        .eq('status', 'fulfilled')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (error) return NextResponse.json({ error: 'Could not load fares' }, { status: 500 })
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
  }

  const insights = aggregate(rows, vehicles, from, to)

  if (q.get('format') === 'csv') {
    return new Response(toCsv(insights), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="safaripap-fares-${from}-to-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json({ ...insights, today }, { headers: { 'Cache-Control': 'no-store' } })
}
