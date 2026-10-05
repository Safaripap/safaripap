import { NextRequest, NextResponse } from 'next/server'
import { memberFromRequest } from '@/lib/member-auth'
import { isReportDate, nairobiDate, publishReports } from '@/lib/nostr-report'

// A manager or owner publishes the signed daily report for their matatus
// (the daily cron publishes yesterday's automatically). Body: { date? },
// default today; no future days.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })
  const { date = nairobiDate() } = await req.json().catch(() => ({}))
  if (typeof date !== 'string' || !isReportDate(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  if (date > nairobiDate()) return NextResponse.json({ error: 'Can’t publish a day that hasn’t happened' }, { status: 400 })

  const vehicles = member.vehicles
    .filter((v) => !v.is_demo)
    .map((v) => ({ id: v.id, vehicle_code: v.vehicle_code, sacco_id: member.saccoId }))
  if (!vehicles.length) return NextResponse.json({ error: 'No matatus to report on' }, { status: 404 })
  return NextResponse.json(await publishReports(vehicles, date))
}
