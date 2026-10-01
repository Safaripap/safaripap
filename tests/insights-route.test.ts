import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  member: null as any,
  rows: [] as any[],
  queries: [] as { in: string[]; gte?: string; lt?: string; range: [number, number] }[],
}))

vi.mock('@/lib/member-auth', () => ({ memberFromRequest: async () => state.member }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = { in: [] as string[] }
      const b: any = {
        select: () => b,
        in: (_c: string, ids: string[]) => ((q.in = ids), b),
        eq: () => b,
        gte: (_c: string, v: string) => ((q.gte = v), b),
        lt: (_c: string, v: string) => ((q.lt = v), b),
        order: () => b,
        range: async (a: number, z: number) => {
          q.range = [a, z]
          state.queries.push(q)
          const scoped = state.rows.filter((r) => q.in.includes(r.vehicle_id))
          return { data: scoped.slice(a, z + 1), error: null }
        },
      }
      return b
    },
  },
}))

import { GET } from '@/app/api/manage/insights/route'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/manage/insights?${qs}`))

const manager = {
  role: 'manager',
  vehicles: [
    { id: 'v1', vehicle_code: 'KAB123B' },
    { id: 'v2', vehicle_code: 'KAC456D' },
  ],
}

beforeEach(() => {
  state.member = manager
  state.rows = []
  state.queries = []
})

describe('GET /api/manage/insights', () => {
  it('is 401 for anyone who is not a manager or owner', async () => {
    state.member = null
    expect((await call('from=2026-10-01&to=2026-10-07')).status).toBe(401)
  })

  it('rejects bad date ranges', async () => {
    expect((await call('from=2026-10-07&to=2026-10-01')).status).toBe(400)
    expect((await call('from=2026-01-01&to=2026-12-31')).status).toBe(400)
  })

  it("refuses a matatu outside the member's scope", async () => {
    expect((await call('from=2026-10-01&to=2026-10-07&vehicle=someone-elses')).status).toBe(403)
  })

  it('only queries vehicles in scope, over this period plus the previous one', async () => {
    await call('from=2026-10-01&to=2026-10-07')
    expect(state.queries[0].in).toEqual(['v1', 'v2'])
    expect(state.queries[0].gte).toBe('2026-09-23T21:00:00.000Z') // Sep 24 00:00 EAT
    expect(state.queries[0].lt).toBe('2026-10-07T21:00:00.000Z') // Oct 8 00:00 EAT
  })

  it('narrows to one matatu when asked', async () => {
    await call('from=2026-10-01&to=2026-10-07&vehicle=v2')
    expect(state.queries[0].in).toEqual(['v2'])
  })

  it('pages through more than 1,000 fares', async () => {
    state.rows = Array.from({ length: 2500 }, () => ({ vehicle_id: 'v1', amount_kes: 50, created_at: '2026-10-02T08:00:00Z' }))
    const body = await (await call('from=2026-10-01&to=2026-10-07')).json()
    expect(state.queries.map((q) => q.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
    expect(body.totals.fares).toBe(2500)
    expect(body.totals.kes).toBe(125000)
  })

  it('returns a CSV download', async () => {
    state.rows = [{ vehicle_id: 'v1', amount_kes: 60, created_at: '2026-10-01T08:00:00Z' }]
    const res = await call('from=2026-10-01&to=2026-10-01&format=csv')
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('safaripap-fares-2026-10-01-to-2026-10-01.csv')
    expect(await res.text()).toBe('date,vehicle,total_kes\n2026-10-01,KAB123B,60\n2026-10-01,KAC456D,0\n')
  })
})
