import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  vehicle: null as any,
  report: null as any,
  sweep: vi.fn(async () => ({ resolved: [], stillPending: 0, settled: 0, republished: 0, errors: [] })),
  publishReports: vi.fn(async (_v: any[], date: string) => ({ date, reports: [{}], failures: [] })),
}))
vi.mock('@/lib/sweep', () => ({ sweep: state.sweep }))
vi.mock('@/lib/nostr-report', async (orig) => ({
  ...(await orig<typeof import('@/lib/nostr-report')>()),
  dailyFares: async () => ({ fares: [{ id: 'a1', amount_kes: 50, receipt_last3: 'F3K', status: 'fulfilled' }], sats: 0 }),
  publishReports: state.publishReports,
  reportableVehicles: async () => [{ id: 'v1', vehicle_code: 'KAB123B', sacco_id: 's1' }],
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const b: any = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: table === 'vehicles' ? state.vehicle : state.report, error: null }),
      }
      return b
    },
  },
}))

import { GET as cron } from '@/app/api/cron/daily/route'
import { GET as verify } from '@/app/api/verify/route'

beforeEach(() => {
  state.vehicle = { id: 'v1', vehicle_code: 'KAB123B', is_demo: false }
  state.report = { event_id: 'ev1', content_hash: 'abc', created_at: '2026-10-05T21:05:00Z' }
  state.sweep.mockClear()
  state.publishReports.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('daily cron', () => {
  const call = (auth?: string) => cron(new NextRequest('http://localhost/api/cron/daily', { headers: auth ? { authorization: auth } : {} }))

  it('refuses anyone without the cron secret, and runs nothing', async () => {
    vi.stubEnv('CRON_SECRET', 'shh')
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(state.sweep).not.toHaveBeenCalled()
  })

  it('refuses everyone when CRON_SECRET is not set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('Bearer ')).status).toBe(401)
  })

  it("sweeps, then publishes yesterday's reports", async () => {
    vi.stubEnv('CRON_SECRET', 'shh')
    const res = await call('Bearer shh')
    expect(res.status).toBe(200)
    expect(state.sweep).toHaveBeenCalledOnce()
    const [, date] = state.publishReports.mock.calls[0]
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('public verify API', () => {
  const call = (qs: string) => verify(new NextRequest(`http://localhost/api/verify?${qs}`))

  it("returns the day's fare list in the hashed shape, with the published report", async () => {
    const res = await call('vehicle=kab 123b&date=2026-10-04')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      vehicleCode: 'KAB123B',
      date: '2026-10-04',
      fares: [{ id: 'a1', amount_kes: 50, receipt_last3: 'F3K', status: 'fulfilled' }],
      report: state.report,
    })
    expect(JSON.stringify(body)).not.toMatch(/phone|payer|mpesa_receipt/)
  })

  it('rejects bad input and demo matatus', async () => {
    expect((await call('vehicle=KAB123B&date=yesterday')).status).toBe(400)
    expect((await call('vehicle=K;drop&date=2026-10-04')).status).toBe(400)
    state.vehicle = { id: 'v', vehicle_code: 'KDG214A', is_demo: true }
    expect((await call('vehicle=KDG214A&date=2026-10-04')).status).toBe(404)
  })
})
