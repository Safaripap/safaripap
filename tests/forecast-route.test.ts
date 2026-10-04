import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ member: null as any, fareQueries: [] as string[][] }))

vi.mock('@/lib/member-auth', () => ({ memberFromRequest: async () => state.member }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let ids: string[] = []
      const b: any = {
        select: () => b,
        in: (_c: string, v: string[]) => ((ids = v), b),
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        range: async () => (state.fareQueries.push(ids), { data: [], error: null }),
        then: (resolve: any) =>
          resolve({
            data: table === 'vehicles' ? ids.map((id) => ({ id, conductor_name: `Conductor ${id}` })) : [],
            error: null,
          }),
      }
      return b
    },
  },
}))

import { GET } from '@/app/api/manage/forecast/route'

const call = () => GET(new NextRequest('http://localhost/api/manage/forecast'))

beforeEach(() => {
  state.fareQueries = []
  state.member = {
    userId: 'u1',
    role: 'owner',
    saccoId: 's1',
    saccoName: 'Super Metro',
    vehicles: [{ id: 'v1', vehicle_code: 'KAB123B', is_demo: false }],
  }
})

describe('GET /api/manage/forecast', () => {
  it('refuses anyone who is not a manager or owner', async () => {
    state.member = null
    expect((await call()).status).toBe(401)
  })

  it("only reads the member's own matatus", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(state.fareQueries).toEqual([['v1'], ['v1']]) // history + today
    expect(body.saccoName).toBe('Super Metro')
    expect(body.vehicles).toEqual([expect.objectContaining({ vehicleCode: 'KAB123B', conductorName: 'Conductor v1' })])
  })
})
