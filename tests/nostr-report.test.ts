import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as any[],
  filters: {} as Record<string, unknown>,
  upserts: [] as any[],
  signed: [] as any[],
  fail: new Set<string>(),
}))
vi.mock('@/lib/nostr', () => ({
  signAndPublish: async (template: any) => {
    const code = template.tags.find((t: string[]) => t[0] === 'vehicle')[1]
    if (state.fail.has(code)) throw new Error('No relay accepted the event')
    state.signed.push(template)
    return { id: `ev-${code}`, relaysOk: ['wss://relay.damus.io'], relaysFailed: [] }
  },
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const b: any = {
        select: () => b,
        eq: (c: string, v: unknown) => ((state.filters[c] = v), b),
        gte: (c: string, v: unknown) => ((state.filters[`${c}>=`] = v), b),
        lt: (c: string, v: unknown) => ((state.filters[`${c}<`] = v), b),
        order: () => b,
        range: async () => ({ data: state.rows, error: null }),
        upsert: async (row: any) => (state.upserts.push({ table, row }), { error: null }),
      }
      return b
    },
  },
}))

import { dayBounds, nairobiDate, publishDailyReport, publishReports } from '@/lib/nostr-report'
import { faresHash } from '@/lib/nostr-events'

beforeEach(() => {
  state.rows = [
    { id: 'a1', amount_kes: 50, receipt_last3: 'F3K', status: 'fulfilled', amount_sats: 500, settled_at: '2026-10-04T08:00:00Z' },
    { id: 'b2', amount_kes: 70, receipt_last3: '', status: 'fulfilled', amount_sats: null, settled_at: null },
  ]
  state.filters = {}
  state.upserts = []
  state.signed = []
  state.fail = new Set()
})

const vehicle = { id: 'v1', vehicle_code: 'KAB123B', sacco_id: 's1' }

describe('Nairobi days', () => {
  it('runs from 00:00 to 24:00 Nairobi time (21:00 UTC the day before)', () => {
    expect(dayBounds('2026-10-04')).toEqual({ from: '2026-10-03T21:00:00.000Z', to: '2026-10-04T21:00:00.000Z' })
    expect(nairobiDate(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
    expect(nairobiDate(new Date('2026-10-04T22:30:00Z'), 1)).toBe('2026-10-04')
  })
})

describe('publishDailyReport', () => {
  it("signs the day's real paid fares and records the hash it signed", async () => {
    const r = await publishDailyReport(vehicle, '2026-10-04')
    expect(state.filters).toMatchObject({ vehicle_id: 'v1', status: 'fulfilled', is_demo: false, 'created_at>=': '2026-10-03T21:00:00.000Z' })
    const hash = faresHash([
      { id: 'a1', amount_kes: 50, receipt_last3: 'F3K', status: 'fulfilled' },
      { id: 'b2', amount_kes: 70, receipt_last3: null, status: 'fulfilled' },
    ])
    expect(r).toMatchObject({ fares: 2, kes: 120, sats: 500, hash, eventId: 'ev-KAB123B' })
    expect(state.signed[0].tags).toContainEqual(['hash', hash])
    expect(state.upserts[0]).toEqual({
      table: 'nostr_reports',
      row: { vehicle_id: 'v1', report_date: '2026-10-04', event_id: 'ev-KAB123B', content_hash: hash, fares: 2, kes: 120, sats: 500 },
    })
  })

  it('rejects a malformed date', async () => {
    await expect(publishDailyReport(vehicle, '4/10/2026')).rejects.toThrow('YYYY-MM-DD')
  })

  it("keeps going when one vehicle's report fails", async () => {
    state.fail.add('KAC456D')
    const out = await publishReports([vehicle, { id: 'v2', vehicle_code: 'KAC456D', sacco_id: 's1' }], '2026-10-04')
    expect(out.reports.map((r) => r.vehicleCode)).toEqual(['KAB123B'])
    expect(out.failures).toEqual([{ vehicleCode: 'KAC456D', error: 'No relay accepted the event' }])
  })
})
