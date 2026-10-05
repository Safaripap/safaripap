import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  stuck: [] as any[],
  unsettled: [] as any[],
  unpublished: [] as any[],
  query: vi.fn(),
  apply: vi.fn(),
  settle: vi.fn(),
  publish: vi.fn(),
}))
vi.mock('@/lib/daraja', () => ({ stkQuery: state.query }))
vi.mock('@/lib/stk-outcome', () => ({ applyStkOutcome: state.apply }))
vi.mock('@/lib/treasury', () => ({ settleTransaction: state.settle }))
vi.mock('@/lib/nostr', () => ({ publishPaymentEvent: state.publish }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const f: Record<string, unknown> = {}
      const b: any = {
        select: () => b,
        eq: (c: string, v: unknown) => ((f[c] = v), b),
        not: () => b,
        is: (c: string, v: unknown) => ((f[`${c} is`] = v), b),
        gte: () => b,
        lt: () => b,
        then: (resolve: any) => {
          // Which of the three queries is this? Tell them apart by their filters.
          const data = f.status === 'processing' ? state.stuck : 'settled_at is' in f ? state.unsettled : state.unpublished
          return resolve({ data, error: null })
        },
      }
      return b
    },
  },
}))

import { sweep } from '@/lib/sweep'

beforeEach(() => {
  state.stuck = []
  state.unsettled = []
  state.unpublished = []
  for (const fn of [state.query, state.apply, state.settle, state.publish]) fn.mockReset()
})

describe('sweep', () => {
  it("applies Daraja's answer to a stuck fare, and leaves one Daraja is still waiting on", async () => {
    state.stuck = [
      { id: 't1', daraja_checkout_id: 'ws_CO_1' },
      { id: 't2', daraja_checkout_id: 'ws_CO_2' },
    ]
    state.query.mockImplementation(async (id: string) =>
      id === 'ws_CO_1' ? { pending: false, resultCode: 1037, resultDesc: 'No response from user.' } : { pending: true }
    )
    state.apply.mockResolvedValue({ txId: 't1', status: 'failed', changed: true })
    const r = await sweep()
    expect(state.apply).toHaveBeenCalledWith({ checkoutRequestId: 'ws_CO_1', resultCode: 1037, resultDesc: 'No response from user.', receipt: null })
    expect(r.resolved).toEqual([{ id: 't1', status: 'failed' }])
    expect(r.stillPending).toBe(1)
  })

  it('settles paid fares the treasury missed, and reports why one still failed', async () => {
    state.unsettled = [{ id: 't3' }, { id: 't4' }]
    state.settle.mockImplementation(async (id: string) => (id === 't3' ? { ok: true, amountSats: 10 } : { ok: false, reason: 'treasury_low' }))
    const r = await sweep()
    expect(r.settled).toBe(1)
    expect(r.errors).toEqual(['settle t4: treasury_low'])
  })

  it('re-publishes paid fares whose Nostr event never reached a relay', async () => {
    state.unpublished = [{ id: 't5', amount_kes: 50, is_demo: false, vehicles: { vehicle_code: 'KAB123B', sacco_id: 's1' } }]
    state.publish.mockResolvedValue('ev1')
    const r = await sweep()
    expect(state.publish).toHaveBeenCalledWith({ txId: 't5', vehicleCode: 'KAB123B', saccoId: 's1', amountKes: 50, demo: undefined })
    expect(r.republished).toBe(1)
  })

  it('keeps going when Daraja errors on one fare', async () => {
    state.stuck = [{ id: 't1', daraja_checkout_id: 'ws_CO_1' }]
    state.query.mockRejectedValue(new Error('Daraja 500'))
    state.unsettled = [{ id: 't3' }]
    state.settle.mockResolvedValue({ ok: true, amountSats: 10 })
    const r = await sweep()
    expect(r.errors).toEqual(['query t1: Daraja 500'])
    expect(r.settled).toBe(1)
  })
})
