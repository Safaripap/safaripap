import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { sweep } from '@/lib/sweep'

// Run the stuck-fare sweep now (the daily cron runs it too). Staff only.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await sweep())
}
