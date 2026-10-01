import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ admin: true, vehicle: null as any }))
vi.mock('@/lib/admin-auth', () => ({ isAdmin: () => state.admin }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: state.vehicle }) }
      return b
    },
  },
}))

import { isLocalOrigin, makeSticker, stickerOrigin } from '@/lib/sticker'
import { GET } from '@/app/api/admin/sticker/route'

const call = (qs: string, origin = 'http://localhost:3000') => GET(new NextRequest(`${origin}/api/admin/sticker?${qs}`))

beforeEach(() => {
  state.admin = true
  state.vehicle = { vehicle_code: 'KYZ456D', is_demo: false }
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('sticker origin', () => {
  it('prefers the deployed address over wherever the admin is browsing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://safaripap.vercel.app/')
    expect(stickerOrigin('http://localhost:3000')).toBe('https://safaripap.vercel.app')
  })

  it('falls back to the request origin', () => {
    expect(stickerOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('spots addresses that only work on this computer or network', () => {
    for (const o of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.20:3000', 'http://10.0.0.5', 'http://laptop.local'])
      expect(isLocalOrigin(o)).toBe(true)
    expect(isLocalOrigin('https://safaripap.vercel.app')).toBe(false)
  })
})

describe('makeSticker', () => {
  it('encodes the pay URL as an SVG QR code', async () => {
    const s = await makeSticker('KYZ456D', 'https://safaripap.vercel.app')
    expect(s.payUrl).toBe('https://safaripap.vercel.app/pay/KYZ456D')
    expect(s.qrSvg).toMatch(/^<svg/)
    expect(s.local).toBe(false)
  })
})

describe('GET /api/admin/sticker', () => {
  it('needs the admin session', async () => {
    state.admin = false
    expect((await call('vehicle=KYZ456D')).status).toBe(401)
  })

  it('returns the sticker, pointing at the deployed site when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://safaripap.vercel.app')
    const body = await (await call('vehicle=kyz-456d')).json()
    expect(body).toMatchObject({ vehicleCode: 'KYZ456D', payUrl: 'https://safaripap.vercel.app/pay/KYZ456D', local: false })
  })

  it('flags a sticker that would point at localhost', async () => {
    expect((await (await call('vehicle=KYZ456D')).json()).local).toBe(true)
  })

  it('refuses demo matatus and unknown codes', async () => {
    state.vehicle = { vehicle_code: 'KDG214A', is_demo: true }
    expect((await call('vehicle=KDG214A')).status).toBe(400)
    state.vehicle = null
    expect((await call('vehicle=NOPE1')).status).toBe(404)
  })
})
