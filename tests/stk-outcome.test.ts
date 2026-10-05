import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  tx: null as any,
  updates: [] as { patch: any; filters: Record<string, unknown> }[],
  settle: vi.fn(async () => ({ ok: true, amountSats: 10 })),
  publish: vi.fn(async () => {}),
}))

vi.mock('@/lib/treasury', () => ({ settleTransaction: state.settle }))
vi.mock('@/lib/nostr', () => ({ publishPaymentEventSoon: state.publish }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      let patch: any = null
      const filters: Record<string, unknown> = {}
      const b: any = {
        select: () => b,
        eq: (c: string, v: unknown) => ((filters[c] = v), b),
        is: (c: string, v: unknown) => ((filters[c] = v), b),
        update: (p: any) => ((patch = p), b),
        maybeSingle: async () => ({ data: state.tx, error: null }),
        // An update only "matches" when its status guard matches the row, like Postgres would.
        then: (resolve: any) => {
          state.updates.push({ patch, filters: { ...filters } })
          const matches = Object.entries(filters).every(([c, v]) => c === 'id' || state.tx[c] === v)
          if (matches) Object.assign(state.tx, patch)
          return resolve({ data: matches ? [{ id: state.tx.id }] : [], error: null })
        },
      }
      return b
    },
  },
}))

import { applyStkOutcome } from '@/lib/stk-outcome'

const paid = (receipt: string | null) => ({
  checkoutRequestId: 'ws_CO_1',
  resultCode: 0,
  resultDesc: 'The service request is processed successfully.',
  receipt,
})

beforeEach(() => {
  state.tx = {
    id: 't1',
    status: 'processing',
    amount_kes: 1,
    mpesa_receipt: null,
    vehicles: { vehicle_code: 'KAB123B', sacco_id: 's1' },
  }
  state.updates = []
  state.settle.mockClear()
  state.publish.mockClear()
})

describe('applyStkOutcome', () => {
  it("marks the fare paid with Daraja's receipt, publishes it, then settles sats from the treasury", async () => {
    await expect(applyStkOutcome(paid('TDK4H7X9F3'))).resolves.toEqual({ txId: 't1', status: 'fulfilled', changed: true })
    expect(state.tx).toMatchObject({ status: 'fulfilled', mpesa_receipt: 'TDK4H7X9F3' })
    expect(state.publish).toHaveBeenCalledWith({ txId: 't1', vehicleCode: 'KAB123B', saccoId: 's1', amountKes: 1 })
    expect(state.settle).toHaveBeenCalledWith('t1')
  })

  it('fills in the receipt when the callback arrives after the STK query already marked the fare paid', async () => {
    await applyStkOutcome(paid(null)) // STK query: paid, no receipt yet
    expect(state.tx).toMatchObject({ status: 'fulfilled', mpesa_receipt: null })
    await applyStkOutcome(paid('TDK4H7X9F3')) // the callback, later
    expect(state.tx.mpesa_receipt).toBe('TDK4H7X9F3')
    expect(state.publish).toHaveBeenCalledOnce() // the fare is only announced once
  })

  it('records a cancelled prompt as failed, with no settlement', async () => {
    await applyStkOutcome({ checkoutRequestId: 'ws_CO_1', resultCode: 1032, resultDesc: 'Request cancelled by user', receipt: null })
    expect(state.tx).toMatchObject({ status: 'failed', failure_reason: 'Request cancelled by user' })
    expect(state.settle).not.toHaveBeenCalled()
  })

  it('never lets a late failure undo a payment', async () => {
    await applyStkOutcome(paid('TDK4H7X9F3'))
    await applyStkOutcome({ checkoutRequestId: 'ws_CO_1', resultCode: 1, resultDesc: 'late', receipt: null })
    expect(state.tx.status).toBe('fulfilled')
  })

  it('ignores a result for a fare it does not know', async () => {
    state.tx = null
    await expect(applyStkOutcome(paid('X'))).resolves.toEqual({ txId: null, status: null, changed: false })
  })
})
