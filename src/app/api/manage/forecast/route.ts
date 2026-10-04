import { NextRequest, NextResponse } from 'next/server'
import { memberFromRequest } from '@/lib/member-auth'
import { forecastForMember } from '@/lib/member-forecast'
import { briefingEnabled } from '@/lib/briefing'

// Tomorrow's projected takings for the signed-in manager (whole sacco) or
// owner (their matatus), from the last 28 days of paid fares. Ported from
// Nauli Sacco's /api/analytics/[saccoId], scoped by member sign-in instead
// of its demo PIN. aiSummary says whether the Claude summary is configured.
export async function GET(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })

  try {
    const forecast = await forecastForMember(member)
    return NextResponse.json({ ...forecast, aiSummary: briefingEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(`forecast for ${member.userId} failed`, e)
    return NextResponse.json({ error: 'Could not build the forecast' }, { status: 500 })
  }
}
