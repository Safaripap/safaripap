import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Stand-in for the service-role Supabase client: records the query it's
// asked to run and returns canned data.
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  vehicle: null as { id: string; conductor_user_id: string } | null,
  results: [] as any[],
  ilike: vi.fn(),
  selectedColumns: [] as string[],
}))

vi.mock('@/lib/supabase-admin', () => {
  const chain = (table: string) => {
    const q: any = {
      select: (cols: string) => {
        state.selectedColumns.push(`${table}:${cols}`)
        return q
      },
      eq: () => q,
      ilike: (col: string, pattern: string) => {
        state.ilike(col, pattern)
        return q
      },
      order: () => q,
      limit: async () => ({ data: state.results, error: null }),
      single: async () => ({ data: state.vehicle, error: state.vehicle ? null : { message: 'none' } }),
    }
    return q
  }
  return {
    supabaseAdmin: {
      auth: { getUser: async () => ({ data: { user: state.user } }) },
      from: chain,
    },
  }
})

import { GET } from '@/app/api/dashboard/search/route'

const call = (qs: string, token?: string) =>
  GET(
    new NextRequest(`http://localhost/api/dashboard/search?${qs}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  )

beforeEach(() => {
  state.user = { id: 'conductor-1' }
  state.vehicle = { id: 'veh-1', conductor_user_id: 'conductor-1' }
  state.results = []
  state.ilike.mockClear()
  state.selectedColumns = []
})

describe('GET /api/dashboard/search', () => {
  it('rejects queries shorter than 4 characters', async () => {
    const res = await call('vehicle=KAB123B&q=9F3', 't')
    expect(res.status).toBe(400)
  })

  it('rejects a missing vehicle', async () => {
    expect((await call('q=SJK49F3', 't')).status).toBe(400)
  })

  it('requires a signed-in conductor', async () => {
    expect((await call('vehicle=KAB123B&q=SJK49F3')).status).toBe(401)
    state.user = null
    expect((await call('vehicle=KAB123B&q=SJK49F3', 'bad')).status).toBe(401)
  })

  it("refuses another vehicle's conductor", async () => {
    state.vehicle = { id: 'veh-1', conductor_user_id: 'someone-else' }
    expect((await call('vehicle=KAB123B&q=SJK49F3', 't')).status).toBe(403)
  })

  it('matches the receipt ending, with wildcards stripped from the query', async () => {
    state.results = [{ id: 'x', mpesa_receipt: 'SJK4H7X9F3' }]
    const res = await call(`vehicle=kab123b&q=${encodeURIComponent('x9f3%_')}`, 't')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [{ id: 'x', mpesa_receipt: 'SJK4H7X9F3' }] })
    // Suffix match only: % at the start, never at the end.
    expect(state.ilike).toHaveBeenCalledWith('mpesa_receipt', '%X9F3')
  })

  it('never selects the passenger phone number', async () => {
    await call('vehicle=KAB123B&q=SJK49F3', 't')
    const txnSelect = state.selectedColumns.find((c) => c.startsWith('transactions:'))!
    expect(txnSelect).not.toContain('payer_phone')
  })
})
