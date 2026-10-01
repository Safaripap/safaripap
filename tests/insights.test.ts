import { describe, expect, it } from 'vitest'
import {
  addDays,
  aggregate,
  changeRatio,
  dayKey,
  daysBetween,
  previousPeriod,
  rangeBounds,
  toCsv,
  validateRange,
} from '@/lib/insights'

const vehicles = [
  { id: 'v1', vehicle_code: 'KAB123B' },
  { id: 'v2', vehicle_code: 'KAC456D' },
  { id: 'v3', vehicle_code: 'KDD789E' },
]
const fare = (vehicle_id: string, amount_kes: number, created_at: string) => ({ vehicle_id, amount_kes, created_at })

describe('Nairobi days', () => {
  it('buckets by Nairobi time, not UTC', () => {
    expect(dayKey('2026-10-04T22:30:00Z')).toBe('2026-10-05') // 01:30 EAT on the 5th
    expect(dayKey('2026-10-05T20:59:59Z')).toBe('2026-10-05') // 23:59 EAT
    expect(dayKey('2026-10-05T21:00:00Z')).toBe('2026-10-06') // midnight EAT
  })

  it('converts a range of days to UTC bounds', () => {
    expect(rangeBounds('2026-10-01', '2026-10-05')).toEqual({
      start: '2026-09-30T21:00:00.000Z',
      end: '2026-10-05T21:00:00.000Z',
    })
  })

  it('walks days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('finds the previous period of the same length', () => {
    expect(previousPeriod('2026-10-01', '2026-10-07')).toEqual({ from: '2026-09-24', to: '2026-09-30' })
    expect(previousPeriod('2026-10-05', '2026-10-05')).toEqual({ from: '2026-10-04', to: '2026-10-04' })
  })
})

describe('validateRange', () => {
  it('accepts a normal range and rejects bad ones', () => {
    expect(validateRange('2026-10-01', '2026-10-07')).toBeNull()
    expect(validateRange('2026-10-07', '2026-10-01')).toMatch(/on or before/)
    expect(validateRange('01/10/2026', '2026-10-07')).toMatch(/2026-10-05/)
    expect(validateRange('2026-01-01', '2026-12-31')).toMatch(/92 days/)
  })
})

describe('aggregate', () => {
  const rows = [
    fare('v1', 60, '2026-10-01T05:00:00Z'),
    fare('v1', 60, '2026-10-01T06:00:00Z'),
    fare('v2', 100, '2026-10-02T07:00:00Z'),
    fare('v1', 80, '2026-10-03T08:00:00Z'),
    // Previous period (Sep 28–30)
    fare('v1', 50, '2026-09-29T08:00:00Z'),
    fare('v2', 50, '2026-09-30T08:00:00Z'),
    // Out of scope vehicle: ignored
    fare('other', 999, '2026-10-02T08:00:00Z'),
  ]
  const ins = aggregate(rows, vehicles, '2026-10-01', '2026-10-03')

  it('totals the period', () => {
    expect(ins.totals).toEqual({ kes: 300, fares: 4, avgKes: 75, activeVehicles: 2, vehicleCount: 3 })
  })

  it('fills every day, including empty ones', () => {
    expect(ins.daily).toEqual([
      { date: '2026-10-01', kes: 120, fares: 2 },
      { date: '2026-10-02', kes: 100, fares: 1 },
      { date: '2026-10-03', kes: 80, fares: 1 },
    ])
  })

  it('compares against the previous period', () => {
    expect(ins.previous).toEqual({ from: '2026-09-28', to: '2026-09-30', kes: 100, fares: 2 })
    expect(changeRatio(ins.totals.kes, ins.previous.kes)).toBe(2)
  })

  it('ranks vehicles by total, with share, average and best day', () => {
    const [first, second, third] = ins.byVehicle
    expect(first).toMatchObject({ code: 'KAB123B', kes: 200, fares: 3, avgKes: 67, daily: [120, 0, 80] })
    expect(first.share).toBeCloseTo(2 / 3)
    expect(first.bestDay).toEqual({ date: '2026-10-01', kes: 120, fares: 2 })
    expect(second).toMatchObject({ code: 'KAC456D', kes: 100, daily: [0, 100, 0] })
    // A vehicle with no fares still shows up, with zeros and no best day.
    expect(third).toMatchObject({ code: 'KDD789E', kes: 0, fares: 0, avgKes: 0, share: 0, bestDay: null })
  })

  it('handles a period with no fares', () => {
    const empty = aggregate([], vehicles, '2026-10-01', '2026-10-01')
    expect(empty.totals).toEqual({ kes: 0, fares: 0, avgKes: 0, activeVehicles: 0, vehicleCount: 3 })
    expect(changeRatio(0, 0)).toBeNull()
  })

  it('exports one CSV row per vehicle per day', () => {
    const csv = toCsv(aggregate(rows, vehicles.slice(0, 1), '2026-10-01', '2026-10-02'))
    expect(csv).toBe('date,vehicle,total_kes\n2026-10-01,KAB123B,120\n2026-10-02,KAB123B,0\n')
  })
})
