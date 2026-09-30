// Fare metrics for the sacco manager / matatu owner dashboard. Pure functions
// so they're unit-testable; the API route fetches rows and calls these.
//
// Days are Nairobi calendar days (EAT, UTC+3, no daylight saving): a fare at
// 01:30 EAT on the 5th counts toward the 5th even though it's the 4th in UTC.

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_RANGE_DAYS = 92

export interface FareRow {
  vehicle_id: string
  amount_kes: number
  created_at: string
}

export interface VehicleRef {
  id: string
  vehicle_code: string
}

export interface DayTotal {
  date: string // YYYY-MM-DD, Nairobi
  kes: number
  fares: number
}

export interface VehicleInsight {
  vehicleId: string
  code: string
  kes: number
  fares: number
  avgKes: number
  share: number // 0..1 of the period's total
  bestDay: DayTotal | null
  daily: number[] // KES per day, aligned with Insights.days
}

export interface Insights {
  from: string
  to: string
  days: string[]
  totals: { kes: number; fares: number; avgKes: number; activeVehicles: number; vehicleCount: number }
  previous: { from: string; to: string; kes: number; fares: number }
  daily: DayTotal[]
  byVehicle: VehicleInsight[]
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

// Nairobi calendar day of an instant.
export function dayKey(instant: string | number | Date): string {
  return new Date(new Date(instant).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length <= MAX_RANGE_DAYS; d = addDays(d, 1)) out.push(d)
  return out
}

// UTC instants covering Nairobi days [from, to]: from 00:00 EAT to the start of
// the day after `to`. Use as created_at >= start and < end.
export function rangeBounds(from: string, to: string): { start: string; end: string } {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - EAT_OFFSET_MS).toISOString(),
    end: new Date(Date.parse(`${addDays(to, 1)}T00:00:00Z`) - EAT_OFFSET_MS).toISOString(),
  }
}

// The same number of days immediately before the range, for "vs previous".
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const len = daysBetween(from, to).length
  return { from: addDays(from, -len), to: addDays(from, -1) }
}

export function validateRange(from: string, to: string): string | null {
  if (!isDay(from) || !isDay(to)) return 'Dates must look like 2026-10-05.'
  if (from > to) return 'The start date must be on or before the end date.'
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) return `Pick a range of ${MAX_RANGE_DAYS} days or less.`
  return null
}

// Rows may span the previous period too; only rows inside [from, to] count
// toward the main figures.
export function aggregate(rows: FareRow[], vehicles: VehicleRef[], from: string, to: string): Insights {
  const days = daysBetween(from, to)
  const index = new Map(days.map((d, i) => [d, i]))
  const prev = previousPeriod(from, to)

  const daily = days.map((date) => ({ date, kes: 0, fares: 0 }))
  const perVehicle = new Map(
    vehicles.map((v) => [v.id, { code: v.vehicle_code, kes: 0, fares: 0, daily: days.map(() => 0), dailyFares: days.map(() => 0) }])
  )
  let prevKes = 0
  let prevFares = 0

  for (const r of rows) {
    const v = perVehicle.get(r.vehicle_id)
    if (!v) continue // not in this member's scope
    const d = dayKey(r.created_at)
    const i = index.get(d)
    if (i !== undefined) {
      daily[i].kes += r.amount_kes
      daily[i].fares += 1
      v.kes += r.amount_kes
      v.fares += 1
      v.daily[i] += r.amount_kes
      v.dailyFares[i] += 1
    } else if (d >= prev.from && d <= prev.to) {
      prevKes += r.amount_kes
      prevFares += 1
    }
  }

  const kes = daily.reduce((s, d) => s + d.kes, 0)
  const fares = daily.reduce((s, d) => s + d.fares, 0)

  const byVehicle: VehicleInsight[] = [...perVehicle.entries()]
    .map(([vehicleId, v]) => {
      let best = -1
      v.daily.forEach((k, i) => {
        if (k > 0 && (best < 0 || k > v.daily[best])) best = i
      })
      return {
        vehicleId,
        code: v.code,
        kes: v.kes,
        fares: v.fares,
        avgKes: v.fares ? Math.round(v.kes / v.fares) : 0,
        share: kes ? v.kes / kes : 0,
        bestDay: best >= 0 ? { date: days[best], kes: v.daily[best], fares: v.dailyFares[best] } : null,
        daily: v.daily,
      }
    })
    .sort((a, b) => b.kes - a.kes || a.code.localeCompare(b.code))

  return {
    from,
    to,
    days,
    totals: {
      kes,
      fares,
      avgKes: fares ? Math.round(kes / fares) : 0,
      activeVehicles: byVehicle.filter((v) => v.fares > 0).length,
      vehicleCount: vehicles.length,
    },
    previous: { ...prev, kes: prevKes, fares: prevFares },
    daily,
    byVehicle,
  }
}

// Change vs the previous period as a fraction (0.12 = +12%), or null when
// there's nothing to compare against.
export function changeRatio(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null
}

// One row per vehicle per day, for spreadsheets.
export function toCsv(ins: Insights): string {
  const lines = ['date,vehicle,total_kes']
  for (const v of ins.byVehicle) ins.days.forEach((d, i) => lines.push(`${d},${v.code},${v.daily[i]}`))
  return lines.join('\n') + '\n'
}
