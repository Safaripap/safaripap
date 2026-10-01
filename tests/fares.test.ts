import { describe, expect, it } from 'vitest'
import {
  dayKey,
  dayOptions,
  dayRange,
  fetchFarePage,
  formatTime,
  formatWhen,
  isLiveHead,
  normalizeQuery,
  PAGE_SIZE,
  sortFares,
  statusOf,
  DEFAULT_VIEW,
  type Txn,
} from '@/lib/fares'

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

const NOW = new Date('2026-10-05T15:00:00+03:00')

describe('formatWhen', () => {
  it('shows only the time for today', () => {
    expect(formatWhen('2026-10-05T14:14:00+03:00', NOW)).toBe('2:14 pm')
  })
  it('says Yesterday for yesterday', () => {
    expect(formatWhen('2026-10-04T08:00:00+03:00', NOW)).toBe('Yesterday, 8:00 am')
  })
  it('adds the date for anything older', () => {
    expect(formatWhen('2026-09-28T19:30:00+03:00', NOW)).toBe('28 Sep, 7:30 pm')
  })
})

describe('day filter', () => {
  it('offers All days, Today, Yesterday and five earlier days', () => {
    const opts = dayOptions(NOW)
    expect(opts).toHaveLength(8)
    expect(opts.slice(0, 3).map((o) => o.label)).toEqual(['All days', 'Today', 'Yesterday'])
    expect(opts[1].value).toBe('2026-10-05')
    expect(opts[7].value).toBe('2026-09-29')
  })

  it('covers exactly one local day', () => {
    const [start, end] = dayRange('2026-10-05')
    expect(start).toBe('2026-10-04T21:00:00.000Z') // midnight in Nairobi
    expect(end).toBe('2026-10-05T21:00:00.000Z')
  })

  it('dayKey uses the local calendar date', () => {
    expect(dayKey(new Date('2026-10-05T23:30:00+03:00'))).toBe('2026-10-05')
  })
})

describe('sortFares', () => {
  const rows = [
    txn({ id: 'a', amount_kes: 60, created_at: '2026-10-05T08:00:00+03:00' }),
    txn({ id: 'b', amount_kes: 100, created_at: '2026-10-05T09:00:00+03:00' }),
    txn({ id: 'c', amount_kes: 60, created_at: '2026-10-05T10:00:00+03:00' }),
  ]
  it('sorts by time either way', () => {
    expect(sortFares(rows, 'newest').map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(sortFares(rows, 'oldest').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
  it('sorts by fare, newest first among equal fares', () => {
    expect(sortFares(rows, 'fare_desc').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortFares(rows, 'fare_asc').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
  it('does not mutate the input', () => {
    sortFares(rows, 'oldest')
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('isLiveHead', () => {
  it('is true only on page 1, newest first, unfiltered or today', () => {
    expect(isLiveHead(DEFAULT_VIEW, NOW)).toBe(true)
    expect(isLiveHead({ ...DEFAULT_VIEW, day: '2026-10-05' }, NOW)).toBe(true)
    expect(isLiveHead({ ...DEFAULT_VIEW, page: 1 }, NOW)).toBe(false)
    expect(isLiveHead({ ...DEFAULT_VIEW, sort: 'fare_desc' }, NOW)).toBe(false)
    expect(isLiveHead({ ...DEFAULT_VIEW, day: '2026-10-04' }, NOW)).toBe(false)
    expect(isLiveHead({ ...DEFAULT_VIEW, q: '48' }, NOW)).toBe(false)
  })
})

describe('fetchFarePage', () => {
  // Records every query-builder call so we can check what gets asked for.
  function fakeClient(result = { data: [txn()], count: 41, error: null }) {
    const calls: [string, ...unknown[]][] = []
    const q: any = new Proxy(
      {},
      {
        get: (_, method: string) =>
          method === 'then'
            ? undefined
            : (...args: unknown[]) => {
                calls.push([method, ...args])
                return method === 'range' ? Promise.resolve(result) : q
              },
      }
    )
    return { client: { from: (t: string) => (calls.push(['from', t]), q) }, calls }
  }

  it('asks for one page of the short columns with a total count', async () => {
    const { client, calls } = fakeClient()
    const res = await fetchFarePage(client, 'veh-1', { ...DEFAULT_VIEW, page: 2 })
    expect(res).toMatchObject({ total: 41 })
    const select = calls.find((c) => c[0] === 'select')!
    expect(select[1]).not.toContain('payer_phone')
    expect(select[1]).not.toContain('mpesa_receipt')
    expect(select[2]).toEqual({ count: 'exact' })
    expect(calls).toContainEqual(['range', 2 * PAGE_SIZE, 3 * PAGE_SIZE - 1])
    expect(calls).toContainEqual(['order', 'created_at', { ascending: false }])
  })

  it('filters to one day', async () => {
    const { client, calls } = fakeClient()
    await fetchFarePage(client, 'veh-1', { ...DEFAULT_VIEW, day: '2026-10-05' })
    expect(calls).toContainEqual(['gte', 'created_at', '2026-10-04T21:00:00.000Z'])
    expect(calls).toContainEqual(['lt', 'created_at', '2026-10-05T21:00:00.000Z'])
  })

  it('sorts by fare with newest as the tiebreak', async () => {
    const { client, calls } = fakeClient()
    await fetchFarePage(client, 'veh-1', { ...DEFAULT_VIEW, sort: 'fare_asc' })
    const orders = calls.filter((c) => c[0] === 'order')
    expect(orders).toEqual([
      ['order', 'amount_kes', { ascending: true }],
      ['order', 'created_at', { ascending: false }],
    ])
  })

  it('matches endings on either field', async () => {
    const { client, calls } = fakeClient()
    await fetchFarePage(client, 'veh-1', { ...DEFAULT_VIEW, q: '48' })
    expect(calls).toContainEqual(['or', 'phone_last3.ilike.%48%,receipt_last3.ilike.%48%'])
  })

  it('returns no rows and passes the error through on failure', async () => {
    const { client } = fakeClient({ data: null as any, count: null as any, error: { message: 'boom' } as any })
    const res = await fetchFarePage(client, 'veh-1', DEFAULT_VIEW)
    expect(res.rows).toEqual([])
    expect(res.error).toBeTruthy()
  })
})
