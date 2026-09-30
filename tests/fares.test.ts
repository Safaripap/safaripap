import { describe, expect, it } from 'vitest'
import { formatTime, normalizeQuery, statusOf, visibleFares, type Txn } from '@/lib/fares'

const txn = (over: Partial<Txn> = {}): Txn => ({
  id: 'a',
  amount_kes: 60,
  phone_last3: '482',
  receipt_last3: '9F3',
  status: 'fulfilled',
  verified_by_conductor: false,
  created_at: '2026-10-05T14:14:00+03:00',
  ...over,
})

describe('formatTime', () => {
  it('uses a 12-hour clock with lowercase am/pm', () => {
    expect(formatTime('2026-10-05T14:14:00+03:00')).toBe('2:14 pm')
    expect(formatTime('2026-10-05T09:05:00+03:00')).toBe('9:05 am')
    expect(formatTime('2026-10-05T00:30:00+03:00')).toBe('12:30 am')
  })
})

describe('statusOf', () => {
  it('always pairs the colour with a word', () => {
    expect(statusOf(txn({ verified_by_conductor: true }))).toEqual({ label: 'Verified', tone: 'route' })
    expect(statusOf(txn())).toEqual({ label: 'Paid — tap to verify', tone: 'wait' })
    expect(statusOf(txn({ status: 'failed' }))).toEqual({ label: 'Failed', tone: 'neutral' })
    expect(statusOf(txn({ status: 'processing' }))).toEqual({ label: 'Waiting…', tone: 'neutral' })
  })

  it('shows Verified even if status changes afterwards', () => {
    expect(statusOf(txn({ verified_by_conductor: true, status: 'processing' })).label).toBe('Verified')
  })
})

describe('normalizeQuery', () => {
  it('uppercases and strips anything that is not a letter or digit', () => {
    expect(normalizeQuery(' 9f3 ')).toBe('9F3')
    expect(normalizeQuery('sjk-4h7')).toBe('SJK4H7')
    expect(normalizeQuery("%_'")).toBe('')
  })
})

describe('visibleFares', () => {
  const rows = [
    txn({ id: 'a', phone_last3: '482', receipt_last3: '9F3' }),
    txn({ id: 'b', phone_last3: '117', receipt_last3: 'K2Q' }),
    txn({ id: 'c', phone_last3: '903', receipt_last3: 'ZZ1' }),
  ]

  it('shows everything with no query', () => {
    expect(visibleFares(rows, '', null)).toHaveLength(3)
  })

  it('matches phone endings locally', () => {
    expect(visibleFares(rows, '482', null).map((r) => r.id)).toEqual(['a'])
  })

  it('matches receipt endings locally, case-insensitively', () => {
    expect(visibleFares(rows, 'K2', null).map((r) => r.id)).toEqual(['b'])
  })

  it('matches partial endings across both fields', () => {
    expect(visibleFares(rows, '9', null).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('shows nothing locally for 4+ characters until the server answers', () => {
    expect(visibleFares(rows, 'SJK49F3', null)).toEqual([])
  })

  it('uses server matches for 4+ characters, keeping live status from the list', () => {
    const live = [txn({ id: 'a', verified_by_conductor: true })]
    const server = [txn({ id: 'a', verified_by_conductor: false, mpesa_receipt: 'SJK4H7X9F3' })]
    const [row] = visibleFares(live, 'X9F3', server)
    expect(row.verified_by_conductor).toBe(true)
    expect(row.mpesa_receipt).toBe('SJK4H7X9F3')
  })

  it('includes server matches that are older than the loaded list', () => {
    const server = [txn({ id: 'old', mpesa_receipt: 'AAA1111XYZ' })]
    expect(visibleFares(rows, '1XYZ', server).map((r) => r.id)).toEqual(['old'])
  })
})
