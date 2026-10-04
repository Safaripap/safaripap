import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { memberFromRequest } from '@/lib/member-auth'
import { buildForecast, fetchPaidFares, forecastWindows } from '@/lib/forecast'

// Tomorrow's projected takings for the signed-in manager (whole sacco) or
// owner (their matatus), from the last 28 days of paid fares. Ported from
// Nauli Sacco's /api/analytics/[saccoId], scoped by member sign-in instead
// of its demo PIN.
export async function GET(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })

  try {
    const ids = member.vehicles.map((v) => v.id)
    const names = new Map<string, string | null>()
    if (ids.length) {
      const { data, error } = await supabaseAdmin.from('vehicles').select('id, conductor_name').in('id', ids)
      if (error) throw error
      for (const v of data ?? []) names.set(v.id, v.conductor_name)
    }

    const now = new Date()
    const w = forecastWindows(now)
    const [history, today] = await Promise.all([
      fetchPaidFares(supabaseAdmin, ids, w.history.from, w.history.to),
      fetchPaidFares(supabaseAdmin, ids, w.today.from, w.today.to),
    ])
    const forecast = buildForecast({
      saccoId: member.saccoId,
      saccoName: member.saccoName,
      vehicles: member.vehicles.map((v) => ({ ...v, conductor_name: names.get(v.id) ?? null })),
      history,
      today,
      now,
    })
    return NextResponse.json(forecast, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(`forecast for ${member.userId} failed`, e)
    return NextResponse.json({ error: 'Could not build the forecast' }, { status: 500 })
  }
}
