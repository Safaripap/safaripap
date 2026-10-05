import { NextRequest, NextResponse } from 'next/server'
import { memberFromRequest } from '@/lib/member-auth'
import { forecastForMember } from '@/lib/member-forecast'
import { briefingEnabled, getBriefing } from '@/lib/briefing'

// The Claude-written forecast summary. Separate from the forecast so the
// numbers render instantly and Claude's latency only affects this box.
// Ported from Nauli Sacco; member sign-in instead of its demo PIN.
export async function POST(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })
  if (!briefingEnabled()) return NextResponse.json({ error: 'AI summary not configured' }, { status: 404 })

  const forecast = await forecastForMember(member).catch(() => null)
  if (!forecast) return NextResponse.json({ error: 'Forecast unavailable' }, { status: 404 })
  const text = await getBriefing(forecast)
  if (!text) return NextResponse.json({ error: 'AI summary unavailable right now' }, { status: 502 })
  return NextResponse.json({ text })
}
