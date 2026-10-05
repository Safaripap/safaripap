import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { canonicalFares, faresHash, fareEvent, reportEvent, tagValue, type ReportFare } from '@/lib/nostr-events'

const fares: ReportFare[] = [
  { id: 'b2', amount_kes: 70, receipt_last3: 'F3K', status: 'fulfilled' },
  { id: 'a1', amount_kes: 50, receipt_last3: null, status: 'fulfilled' },
]

describe('daily report hash', () => {
  it('is SHA-256 of the canonical list, matching Node’s own SHA-256', () => {
    const canonical = canonicalFares(fares)
    expect(canonical).toBe('[["a1",50,"","fulfilled"],["b2",70,"F3K","fulfilled"]]')
    expect(faresHash(fares)).toBe(createHash('sha256').update(canonical).digest('hex'))
  })

  it("doesn't depend on the order the database returns fares in", () => {
    expect(faresHash([...fares].reverse())).toBe(faresHash(fares))
  })

  it('changes if any fare is added, removed or edited', () => {
    const h = faresHash(fares)
    expect(faresHash(fares.slice(1))).not.toBe(h)
    expect(faresHash([{ ...fares[0], amount_kes: 700 }, fares[1]])).not.toBe(h)
    expect(faresHash([...fares, { id: 'c3', amount_kes: 1, receipt_last3: 'X1Y', status: 'fulfilled' }])).not.toBe(h)
  })
})

describe('report event', () => {
  const e = reportEvent({ vehicleCode: 'KAB123B', saccoId: 's1', date: '2026-10-04', fares, sats: 1200 }, 100)

  it('is addressable by vehicle and day, so a re-publish replaces it', () => {
    expect(e.kind).toBe(30078)
    expect(tagValue(e.tags, 'd')).toBe('safaripap:report:KAB123B:2026-10-04')
    expect(tagValue(e.tags, 't')).toBe('safaripap-report')
  })

  it('carries the totals and the hash, and nothing about passengers', () => {
    const c = JSON.parse(e.content)
    expect(c).toMatchObject({ vehicle: 'KAB123B', date: '2026-10-04', fares: 2, kes: 120, sats: 1200, hash: faresHash(fares) })
    expect(tagValue(e.tags, 'hash')).toBe(faresHash(fares))
    expect(e.content).not.toMatch(/F3K|phone/)
  })
})

describe('fare event', () => {
  it('is addressable by fare id', () => {
    expect(tagValue(fareEvent({ txId: 't1', vehicleCode: 'K', saccoId: 's', amountKes: 1 }).tags, 'd')).toBe('safaripap:fare:t1')
  })
})
