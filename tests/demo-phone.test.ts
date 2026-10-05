import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  vehicle: { id: 'v1', vehicle_code: 'KAB123B', is_demo: false, lightning_address: 'kab123b@x.lnbits.com' } as any,
  txn: null as any,
  inserted: [] as any[],
  updates: [] as { patch: any; filters: Record<string, unknown> }[],
  collect: vi.fn(),
  publish: vi.fn(async (_input: Record<string, unknown>) => {}),
}))

vi.mock('@/lib/nostr', () => ({ publishPaymentEventSoon: state.publish }))

vi.mock('@/lib/daraja', () => ({ stkPush: state.collect }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let patch: any = null
      const filters: Record<string, unknown> = {}
      const b: any = {
        select: () => b,
        eq: (c: string, v: unknown) => ((filters[c] = v), b),
        or: () => b,
        insert: async (row: any) => (state.inserted.push(row), { error: null }),
        update: (p: any) => ((patch = p), b),
        single: async () =>
          table === 'vehicles' ? { data: state.vehicle, error: null } : { data: state.txn, error: state.txn ? null : { message: 'x' } },
        maybeSingle: async () => {
          state.updates.push({ patch, filters: { ...filters } })
          return { data: { ...state.txn, ...patch, receipt_last3: 'F3K', vehicles: { vehicle_code: 'KAB123B', sacco_id: 's1' } } }
        },
      }
      return b
    },
  },
}))

import { POST as pay } from '@/app/api/pay/route'
import { GET as status } from '@/app/api/transactions/[code]/route'
import { isDemoPhone } from '@/lib/demo-phone'

const payWith = (phone: string) =>
  pay(new NextRequest('http://localhost/api/pay', { method: 'POST', body: JSON.stringify({ vehicleCode: 'KAB123B', amountKes: 50, phone }) }))
const poll = (code: string) => status(new NextRequest('http://localhost'), { params: { code } })

beforeEach(() => {
  vi.stubEnv('DEMO_PHONE', '0727358159')
  state.inserted = []
  state.updates = []
  state.collect.mockReset()
  state.publish.mockClear()
  state.collect.mockResolvedValue({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1', customerMessage: '' })
})
afterEach(() => vi.unstubAllEnvs())

describe('isDemoPhone', () => {
  it('matches the demo number in any format, and nothing when unset', () => {
    expect(isDemoPhone('254727358159')).toBe(true)
    expect(isDemoPhone('0727 358 159')).toBe(true)
    expect(isDemoPhone('254712345678')).toBe(false)
    vi.stubEnv('DEMO_PHONE', '')
    expect(isDemoPhone('254727358159')).toBe(false)
  })
})

describe('paying with the demo phone', () => {
  it('records a demo fare without sending an STK push', async () => {
    const res = await payWith('254727358159')
    const body = await res.json()
    expect(state.collect).not.toHaveBeenCalled()
    expect(body.transactionCode).toMatch(/^DEMO-/)
    expect(state.inserted[0]).toMatchObject({ status: 'processing', is_demo: true, vehicle_id: 'v1', amount_kes: 50 })
  })

  it('still sends every other number an M-Pesa prompt', async () => {
    await payWith('254712345678')
    expect(state.collect).toHaveBeenCalledOnce()
    expect(state.inserted[0].is_demo).toBeUndefined()
    expect(state.inserted[0]).toMatchObject({ daraja_checkout_id: 'ws_CO_1', status: 'processing', amount_kes: 50 })
  })

  it('refuses a fare that is not whole shillings from KES 1, without a prompt', async () => {
    for (const amountKes of [0, 0.5, '50']) {
      const res = await pay(
        new NextRequest('http://localhost/api/pay', {
          method: 'POST',
          body: JSON.stringify({ vehicleCode: 'KAB123B', amountKes, phone: '254712345678' }),
        })
      )
      expect(res.status).toBe(400)
    }
    expect(state.collect).not.toHaveBeenCalled()
  })

  it('sends the M-Pesa prompt as normal when DEMO_PHONE is not set', async () => {
    vi.stubEnv('DEMO_PHONE', '')
    await payWith('254727358159')
    expect(state.collect).toHaveBeenCalledOnce()
  })
})

describe('polling a demo fare', () => {
  it('stays processing for the first few seconds', async () => {
    state.txn = { status: 'processing', amount_kes: 50, created_at: new Date().toISOString() }
    const body = await (await poll('DEMO-ABC')).json()
    expect(body.status).toBe('processing')
    expect(body.created_at).toBeUndefined()
    expect(state.updates).toHaveLength(0)
  })

  it('settles as paid after that, touching only demo rows', async () => {
    state.txn = { status: 'processing', amount_kes: 50, created_at: new Date(Date.now() - 6000).toISOString() }
    const body = await (await poll('DEMO-ABC')).json()
    expect(body.status).toBe('fulfilled')
    expect(body.mpesa_receipt).toMatch(/^T[A-Z0-9]{9}$/)
    expect(state.updates[0].filters).toMatchObject({ bitika_transaction_code: 'DEMO-ABC', is_demo: true, status: 'processing' })
    expect(body.vehicles).toBeUndefined()
  })

  it('publishes a receipt marked as demo, so the sacco totals page counts it', async () => {
    state.txn = { status: 'processing', amount_kes: 50, created_at: new Date(Date.now() - 6000).toISOString() }
    await poll('DEMO-ABC')
    expect(state.publish).toHaveBeenCalledOnce()
    expect(state.publish.mock.calls[0][0]).toMatchObject({ vehicleCode: 'KAB123B', saccoId: 's1', amountKes: 50, demo: true })
  })

  it('never settles a real Bitika fare on its own', async () => {
    state.txn = { status: 'processing', amount_kes: 50, created_at: new Date(Date.now() - 60000).toISOString() }
    const body = await (await poll('SBX-6B036C')).json()
    expect(body.status).toBe('processing')
    expect(state.updates).toHaveLength(0)
    expect(state.publish).not.toHaveBeenCalled()
  })
})
