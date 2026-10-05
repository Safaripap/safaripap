import { describe, expect, it } from 'vitest'
import { bestShift, buildForecast, forecastWindows, nairobiDayStartISO, peakHours, type PaidFare } from '@/lib/forecast'

// Sunday 4 Oct 2026, 10:30 in Nairobi (07:30 UTC). Tomorrow is Monday 5 Oct.
const NOW = new Date('2026-10-04T07:30:00Z')
const vehicles = [
  { id: 'v1', vehicle_code: 'KAB123B', conductor_name: 'Otieno' },
  { id: 'v2', vehicle_code: 'KAC456D', conductor_name: null },
]

// A fare at a Nairobi date and hour.
const fare = (vehicle_id: string, date: string, hour: number, amount_kes: number): PaidFare => ({
  vehicle_id,
  amount_kes,
  created_at: new Date(`${date}T${String(hour).padStart(2, '0')}:15:00+03:00`).toISOString(),
})

// The four Mondays in the 28-day window before NOW.
const MONDAYS = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

describe('forecast windows', () => {
  it('uses 28 full Nairobi days of history, then today so far', () => {
    const w = forecastWindows(NOW)
    expect(w.history).toEqual({ from: '2026-09-05T21:00:00.000Z', to: '2026-10-03T21:00:00.000Z' })
    expect(w.today).toEqual({ from: '2026-10-03T21:00:00.000Z', to: NOW.toISOString() })
    expect(nairobiDayStartISO(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-04T21:00:00.000Z') // 01:30 EAT on the 5th
  })
})

describe('buildForecast', () => {
  const history = [
    // KAB123B: 2 x KES 50 at 07:00 every Monday, and one KES 100 Monday at 18:00.
    ...MONDAYS.flatMap((d) => [fare('v1', d, 7, 50), fare('v1', d, 7, 50)]),
    fare('v1', MONDAYS[0], 18, 100),
    // KAC456D: KES 80 at 08:00 every Monday; and a Sunday fare that only feeds today's projection.
    ...MONDAYS.map((d) => fare('v2', d, 8, 80)),
    fare('v2', '2026-09-27', 9, 40),
  ]
  const today = [fare('v2', '2026-10-04', 9, 60), fare('v1', '2026-10-04', 6, 70)]
  const f = buildForecast({ saccoId: 's1', saccoName: 'Super Metro', vehicles, history, today, now: NOW })

  it('projects tomorrow as the mean of the last four same weekdays', () => {
    expect(f.tomorrow).toEqual({ weekday: 'Monday', date: '2026-10-05' })
    // v1: (4 Mondays x 100 + 100) / 4 = 125; v2: 4 x 80 / 4 = 80.
    expect(f.vehicles.map((v) => [v.vehicleCode, v.tomorrowKes])).toEqual([
      ['KAB123B', 125],
      ['KAC456D', 80],
    ])
    expect(f.fleet.tomorrowKes).toBe(205)
    expect(f.fleet.tomorrowHourly[7]).toBe(100)
    expect(f.fleet.tomorrowHourly[18]).toBe(25)
    // 9 fares over 4 Mondays for v1 → 2.25 → 2; 4 → 1 for v2.
    expect(f.vehicles[0].tomorrowFares).toBe(2)
    expect(f.fleet.tomorrowFares).toBe(3)
  })

  it('finds peak hours and the best 8-hour shift', () => {
    expect(f.fleet.peakHours).toEqual([7, 8, 18])
    expect(f.vehicles[0].peakHours).toEqual([7, 18])
    expect(f.fleet.shift).toEqual({ start: 1, end: 9, kes: 180 }) // 07:00 (100) + 08:00 (80); earliest window wins a tie
  })

  it('tracks today against what a usual Sunday had by this hour', () => {
    expect(f.today).toEqual({ weekday: 'Sunday', currentHour: 10 })
    expect(f.fleet.todayActualHourly[6]).toBe(70)
    expect(f.fleet.todayActualHourly[9]).toBe(60)
    const v2 = f.vehicles.find((v) => v.vehicleCode === 'KAC456D')!
    expect(v2.todayActualKes).toBe(60)
    expect(v2.todayProjectedSoFarKes).toBe(10) // one KES 40 Sunday at 09:00 / 4 weeks
  })

  it('keeps conductor names and copes with a vehicle that has no history', () => {
    expect(f.vehicles[0].conductorName).toBe('Otieno')
    const empty = buildForecast({ saccoId: 's1', saccoName: 'S', vehicles, history: [], today: [], now: NOW })
    expect(empty.fleet.tomorrowKes).toBe(0)
    expect(empty.fleet.peakHours).toEqual([])
    expect(empty.vehicles[0].peakHours).toEqual([])
  })
})

describe('helpers', () => {
  it('peakHours ignores empty hours and returns the busiest first', () => {
    const h = Array(24).fill(0)
    h[7] = 10
    h[17] = 30
    h[18] = 20
    h[12] = 5
    expect(peakHours(h)).toEqual([17, 18, 7])
  })

  it('bestShift picks the busiest contiguous 8 hours', () => {
    const h = Array(24).fill(0)
    h[6] = 50
    h[13] = 50
    h[14] = 60
    expect(bestShift(h)).toEqual({ start: 7, end: 15, kes: 110 })
  })
})
