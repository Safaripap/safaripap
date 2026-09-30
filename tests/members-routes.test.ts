import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ admin: false, member: null as any }))

vi.mock('@/lib/lnbits', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/admin-auth', () => ({ isAdmin: () => state.admin }))
vi.mock('@/lib/member-auth', () => ({ memberFromRequest: async () => state.member }))

import { GET as listMembers, POST as createMemberRoute } from '@/app/api/admin/members/route'
import { PATCH as resetPin, DELETE as removeMemberRoute } from '@/app/api/admin/members/[userId]/route'
import { GET as me } from '@/app/api/manage/me/route'

const req = (method = 'GET', body?: unknown) =>
  new NextRequest('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  state.admin = false
  state.member = null
})

describe('admin member routes', () => {
  it('refuse everything without the admin session', async () => {
    expect((await listMembers(req())).status).toBe(401)
    expect((await createMemberRoute(req('POST', {}))).status).toBe(401)
    expect((await resetPin(req('PATCH'), { params: { userId: 'u' } })).status).toBe(401)
    expect((await removeMemberRoute(req('DELETE'), { params: { userId: 'u' } })).status).toBe(401)
  })

  it('validate input before touching the database', async () => {
    state.admin = true
    const res = await createMemberRoute(req('POST', { role: 'owner', fullName: 'A', phone: '0712345678', saccoId: 's' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/at least one vehicle/)
  })
})

describe('GET /api/manage/me', () => {
  it('is 401 for anyone who is not a manager or owner', async () => {
    expect((await me(req())).status).toBe(401)
  })

  it('returns the member and their vehicles', async () => {
    state.member = { role: 'owner', fullName: 'Achieng', vehicles: [{ id: 'v', vehicle_code: 'KAC456D' }] }
    const res = await me(req())
    expect(res.status).toBe(200)
    expect((await res.json()).vehicles[0].vehicle_code).toBe('KAC456D')
  })
})
