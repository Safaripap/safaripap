import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ tx: null as any, updates: [] as any[] }))
const ln = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  getBalance: vi.fn(),
  getPayment: vi.fn(),
  payInvoice: vi.fn(),
}))

vi.mock('@/lib/lnbits-wallet', () => ln)
vi.mock('@/lib/pricing', () => ({ kesToSats: async (kes: number) => ({ sats: kes * 10, rate: 1e7 }) }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      let update: any = null
      const b: any = {
        select: () => b,
        eq: () => b,
        is: () => b,
        update: (u: any) => ((update = u), state.updates.push(u), b),
        maybeSingle: async () => ({ data: state.tx, error: null }),
        // Awaiting an update chain: a claim "select" returns the row it claimed.
        then: (resolve: any) => resolve({ data: update ? [{ id: 't1' }] : null, error: null }),
      }
      return b
    },
  },
}))

import { settleTransaction } from '@/lib/treasury'

const darajaTx = {
  id: 't1',
  status: 'fulfilled',
  daraja_checkout_id: 'ws_CO_1',
  settled_at: null,
  amount_kes: 50,
  mpesa_receipt: 'TDK4H7X9F3',
  ln_payment_hash: null,
  amount_sats: null,
  vehicles: { vehicle_code: 'KAB123B', lnbits_invoice_key: 'vehicle-inkey' },
}

beforeEach(() => {
  vi.stubEnv('LNBITS_TREASURY_ADMIN_KEY', 'treasury-admin')
  state.tx = { ...darajaTx }
  state.updates = []
  Object.values(ln).forEach((f) => f.mockReset())
})

describe('settleTransaction', () => {
  it('never pays out for a Bitika fare, which Bitika already settled', async () => {
    state.tx = { ...darajaTx, daraja_checkout_id: null }
    await expect(settleTransaction('t1')).resolves.toEqual({ ok: false, reason: 'not_daraja' })
    expect(ln.payInvoice).not.toHaveBeenCalled()
  })

  it('does nothing for a fare that is already settled', async () => {
    state.tx = { ...darajaTx, settled_at: '2026-10-04T08:00:00Z', amount_sats: 500 }
    await expect(settleTransaction('t1')).resolves.toEqual({ ok: true, amountSats: 500 })
    expect(ln.payInvoice).not.toHaveBeenCalled()
  })

  it('leaves the fare unsettled when the treasury is too low', async () => {
    ln.getBalance.mockResolvedValue(100)
    await expect(settleTransaction('t1')).resolves.toEqual({ ok: false, reason: 'treasury_low' })
    expect(state.updates).toContainEqual({ failure_reason: 'treasury_low' })
    expect(ln.payInvoice).not.toHaveBeenCalled()
  })

  it("pays the vehicle's invoice from the treasury and records settled_at", async () => {
    ln.getBalance.mockResolvedValue(10_000)
    ln.createInvoice.mockResolvedValue({ bolt11: 'lnbc1', paymentHash: 'h1' })
    ln.payInvoice.mockResolvedValue({ paymentHash: 'h1' })
    await expect(settleTransaction('t1')).resolves.toEqual({ ok: true, amountSats: 500 })
    expect(ln.createInvoice).toHaveBeenCalledWith('vehicle-inkey', 500, 'Safaripap KAB123B fare TDK4H7X9F3')
    expect(ln.payInvoice).toHaveBeenCalledWith('treasury-admin', 'lnbc1')
    expect(state.updates.at(-1)).toMatchObject({ failure_reason: null, settled_at: expect.any(String) })
    expect(state.updates.at(-1).status).toBeUndefined() // stays 'fulfilled'
  })
})

describe('unexpected settlement errors', () => {
  it('are recorded on the fare, not just logged', async () => {
    ln.getBalance.mockRejectedValue(new Error('LNbits GET /api/v1/wallet returned 200 with no JSON'))
    await expect(settleTransaction('t1')).rejects.toThrow('no JSON')
    expect(state.updates.at(-1)).toEqual({ failure_reason: 'settlement_error: LNbits GET /api/v1/wallet returned 200 with no JSON' })
  })
})
