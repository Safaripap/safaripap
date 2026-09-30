// A single shared passcode (ADMIN_PASSCODE) guards the onboarding admin.
// Enough for a hackathon demo; swap for real admin accounts before going wide.
// The cookie holds an HMAC of the passcode, never the passcode itself.

import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const ADMIN_COOKIE = 'safaripap_admin'
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSCODE
}

export function adminToken(): string {
  return createHmac('sha256', process.env.ADMIN_PASSCODE ?? '').update('safaripap-admin-v1').digest('hex')
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function passcodeMatches(passcode: string): boolean {
  return adminConfigured() && safeEqual(passcode, process.env.ADMIN_PASSCODE!)
}

export function isAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value
  return adminConfigured() && !!cookie && safeEqual(cookie, adminToken())
}
