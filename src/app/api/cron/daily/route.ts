import { NextRequest, NextResponse } from 'next/server'
import { sweep } from '@/lib/sweep'
import { nairobiDate, publishReports, reportableVehicles } from '@/lib/nostr-report'

// Daily job (vercel.json, 00:05 Nairobi): tidy stuck fares, then publish
// yesterday's signed Nostr report for every real vehicle. Vercel sends
// Authorization: Bearer $CRON_SECRET; anything else is refused.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const swept = await sweep()
  const reports = await publishReports(await reportableVehicles(), nairobiDate(new Date(), 1))
  return NextResponse.json({
    swept,
    reports: { date: reports.date, published: reports.reports.length, failures: reports.failures },
  })
}
