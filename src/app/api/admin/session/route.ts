import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminConfigured, adminToken, isAdmin, passcodeMatches } from '@/lib/admin-auth'

// GET: am I signed in? POST: sign in with the passcode. DELETE: sign out.
export async function GET(req: NextRequest) {
  return NextResponse.json({ configured: adminConfigured(), signedIn: isAdmin(req) })
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Admin is not set up: add ADMIN_PASSCODE to the environment.' }, { status: 503 })
  }
  const { passcode } = await req.json().catch(() => ({}))
  if (typeof passcode !== 'string' || !passcodeMatches(passcode)) {
    return NextResponse.json({ error: 'Wrong passcode.' }, { status: 401 })
  }
  const res = NextResponse.json({ signedIn: true })
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ signedIn: false })
  res.cookies.delete(ADMIN_COOKIE)
  return res
}
