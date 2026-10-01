import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { parsePlates, toJoinRequest, validateJoin, type JoinInput } from '@/lib/join'

const state = vi.hoisted(() => ({ admin: false, recent: [] as any[], inserted: [] as any[], updated: null as any }))
vi.mock('@/lib/admin-auth', () => ({ isAdmin: () => state.admin }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        order: () => b,
        limit: async () => ({ data: state.recent, error: null }),
        insert: async (row: any) => (state.inserted.push(row), { error: null }),
        update: (patch: any) => ((state.updated = patch), b),
        then: (resolve: any) => resolve({ error: null }),
      }
      return b
    },
  },
}))

import { POST as join } from '@/app/api/join/route'
import { GET as listRequests } from '@/app/api/admin/requests/route'
import { PATCH as updateRequest } from '@/app/api/admin/requests/[id]/route'

const good = (over: Partial<JoinInput> = {}): JoinInput => ({
  saccoName: ' Super Metro ',
  contactName: 'Wanjiru Kamau',
  phone: '0712 345 678',
  role: 'manager',
  matatuCount: 12,
  plates: 'kab 123b, KAC-456D\nKAC456D, x',
  notes: '  Call after 5pm ',
  ...over,
})

const post = (body: unknown) => join(new NextRequest('http://localhost/api/join', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  state.admin = false
  state.recent = []
  state.inserted = []
  state.updated = null
})

describe('join validation', () => {
  it('cleans up plates: uppercase, no spaces, no duplicates, no junk', () => {
    expect(parsePlates('kab 123b, KAC-456D\nKAC456D, x')).toEqual(['KAB123B', 'KAC456D'])
  })

  it('accepts a good request and normalises it', () => {
    expect(validateJoin(good())).toBeNull()
    expect(toJoinRequest(good())).toEqual({
      sacco_name: 'Super Metro',
      contact_name: 'Wanjiru Kamau',
      phone: '254712345678',
      role: 'manager',
      matatu_count: 12,
      plates: ['KAB123B', 'KAC456D'],
      notes: 'Call after 5pm',
    })
  })

  it('explains what is wrong', () => {
    expect(validateJoin(good({ saccoName: '' }))).toMatch(/sacco/)
    expect(validateJoin(good({ phone: '0812345678' }))).toMatch(/Kenyan mobile/)
    expect(validateJoin(good({ matatuCount: 0 }))).toMatch(/how many matatus/)
    expect(validateJoin(good({ role: 'admin' as any }))).toMatch(/manage the sacco or own/)
  })
})

describe('POST /api/join', () => {
  it('saves a valid request', async () => {
    const res = await post(good())
    expect(res.status).toBe(200)
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0].phone).toBe('254712345678')
  })

  it('rejects invalid input', async () => {
    expect((await post(good({ phone: '123' }))).status).toBe(400)
    expect(state.inserted).toHaveLength(0)
  })

  it('quietly drops bots that fill the hidden field', async () => {
    const res = await post({ ...good(), website: 'http://spam.example' })
    expect(res.status).toBe(200)
    expect(state.inserted).toHaveLength(0)
  })

  it('ignores a repeat from the same phone within 10 minutes', async () => {
    state.recent = [{ id: 'r1' }]
    expect((await post(good())).status).toBe(200)
    expect(state.inserted).toHaveLength(0)
  })
})

describe('admin request routes', () => {
  it('need the admin session', async () => {
    expect((await listRequests(new NextRequest('http://localhost/x'))).status).toBe(401)
    const res = await updateRequest(new NextRequest('http://localhost/x', { method: 'PATCH', body: '{"status":"done"}' }), {
      params: { id: 'r1' },
    })
    expect(res.status).toBe(401)
  })

  it('mark a request handled, and reject unknown statuses', async () => {
    state.admin = true
    const ok = await updateRequest(new NextRequest('http://localhost/x', { method: 'PATCH', body: '{"status":"done"}' }), {
      params: { id: 'r1' },
    })
    expect(ok.status).toBe(200)
    expect(state.updated.status).toBe('done')
    expect(state.updated.handled_at).toBeTruthy()
    const bad = await updateRequest(new NextRequest('http://localhost/x', { method: 'PATCH', body: '{"status":"deleted"}' }), {
      params: { id: 'r1' },
    })
    expect(bad.status).toBe(400)
  })
})
