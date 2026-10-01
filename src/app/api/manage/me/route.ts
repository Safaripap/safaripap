import { NextRequest, NextResponse } from 'next/server'
import { memberFromRequest } from '@/lib/member-auth'

// Who is signed in to /manage, their sacco, and the vehicles they may see.
export async function GET(req: NextRequest) {
  const member = await memberFromRequest(req)
  if (!member) return NextResponse.json({ error: 'Not a sacco manager or owner' }, { status: 401 })
  return NextResponse.json(member)
}
