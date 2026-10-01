import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }))

import { ADMIN_COOKIE, adminToken, isAdmin, passcodeMatches } from '@/lib/admin-auth'
import { POST as login } from '@/app/api/admin/session/route'
import { POST as onboard } from '@/app/api/admin/onboard/route'

const req = (url: string, init: { cookie?: string; body?: unknown } = {}) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}) },
    body: JSON.stringify(init.body ?? {}),
  })

beforeEach(() => vi.stubEnv('ADMIN_PASSCODE', 'correct horse battery'))
afterEach(() => vi.unstubAllEnvs())

describe('admin auth', () => {
  it('checks the passcode', () => {
    expect(passcodeMatches('correct horse battery')).toBe(true)
    expect(passcodeMatches('wrong')).toBe(false)
  })

  it('is disabled when no passcode is configured', () => {
    vi.stubEnv('ADMIN_PASSCODE', '')
    expect(passcodeMatches('')).toBe(false)
  })

  it('never puts the passcode itself in the cookie', async () => {
    const res = await login(req('http://localhost/api/admin/session', { body: { passcode: 'correct horse battery' } }))
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${ADMIN_COOKIE}=${adminToken()}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain('correct')
  })

  it('rejects a wrong passcode', async () => {
    const res = await login(req('http://localhost/api/admin/session', { body: { passcode: 'nope' } }))
    expect(res.status).toBe(401)
  })

  it('recognises a signed-in admin by cookie', () => {
    expect(isAdmin(req('http://localhost/x', { cookie: `${ADMIN_COOKIE}=${adminToken()}` }))).toBe(true)
    expect(isAdmin(req('http://localhost/x', { cookie: `${ADMIN_COOKIE}=forged` }))).toBe(false)
  })

  it('refuses to onboard without signing in', async () => {
    const res = await onboard(req('http://localhost/api/admin/onboard', { body: { vehicleCode: 'KAB456C' } }))
    expect(res.status).toBe(401)
  })

  it('validates the form before starting', async () => {
    const res = await onboard(
      req('http://localhost/api/admin/onboard', {
        cookie: `${ADMIN_COOKIE}=${adminToken()}`,
        body: { vehicleCode: 'K', conductorName: 'W', saccoId: 's-1' },
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/plate/)
  })
})
