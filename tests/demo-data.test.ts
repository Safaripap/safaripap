import { describe, expect, it } from 'vitest'
import { aggregate, dayKey } from '@/lib/insights'
import { DEMO_ADDRESS_DOMAIN, clearDemo, demoFares, demoPlate, demoVehicles, generateDemo, seededRng, validateDemoInput } from '@/lib/demo-data'

const NOW = new Date('2026-10-05T11:00:00Z') // Monday 14:00 in Nairobi

describe('demo plates and vehicles', () => {
  it('makes Kenyan-style plates that never collide with existing ones', () => {
    const taken = new Set(['KDG214A'])
    const rng = seededRng(1)
    const plates = Array.from({ length: 50 }, () => demoPlate(rng, taken))
    expect(new Set(plates).size).toBe(50)
    expect(plates).not.toContain('KDG214A')
    for (const p of plates) expect(p).toMatch(/^K[BCDE][A-Z]\d{3}[A-Z]$/)
  })

  it('gives each demo matatu a conductor name and a route fare', () => {
    const vs = demoVehicles(seededRng(2), 3, new Set())
    expect(vs).toHaveLength(3)
    for (const v of vs) {
      expect(v.conductor_name).toBeTruthy()
      expect([50, 60, 70, 80, 100]).toContain(v.preset_fare_kes)
    }
  })
})

describe('demoFares', () => {
  const vehicles = [
    { id: 'v1', preset_fare_kes: 60 },
    { id: 'v2', preset_fare_kes: 80 },
  ]
  const fares = demoFares(seededRng(42), vehicles, 28, NOW)

  it('is deterministic for a seed', () => {
    expect(demoFares(seededRng(42), vehicles, 28, NOW)).toEqual(fares)
  })

  it('never puts a fare in the future, and covers the whole range', () => {
    expect(fares.every((f) => Date.parse(f.created_at) <= NOW.getTime())).toBe(true)
    const days = new Set(fares.map((f) => dayKey(f.created_at)))
    expect(days.has(dayKey(NOW))).toBe(true) // some fares already today
    expect(days.size).toBeGreaterThan(20)
  })

  it('looks like real fares: paid, flagged as demo, plausible amounts and phones', () => {
    for (const f of fares) {
      expect(f.status).toBe('fulfilled')
      expect(f.is_demo).toBe(true)
      expect(f.amount_kes).toBeGreaterThanOrEqual(30)
      expect(f.payer_phone).toMatch(/^254[71]\d{8}$/)
      expect(f.mpesa_receipt).toMatch(/^T[A-Z0-9]{9}$/)
    }
  })

  it('is busiest in the rush hours and quieter on Sundays', () => {
    const eatHour = (iso: string) => (new Date(iso).getUTCHours() + 3) % 24
    const rush = fares.filter((f) => [6, 7, 8, 16, 17, 18, 19].includes(eatHour(f.created_at))).length
    expect(rush / fares.length).toBeGreaterThan(0.55)
    expect(fares.every((f) => eatHour(f.created_at) >= 6 && eatHour(f.created_at) <= 21)).toBe(true)

    const ins = aggregate(fares as any, [{ id: 'v1', vehicle_code: 'A' }, { id: 'v2', vehicle_code: 'B' }], '2026-09-08', '2026-10-04')
    const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
      const ds = ins.daily.filter((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === wd)
      return ds.reduce((s, d) => s + d.fares, 0) / ds.length
    })
    const weekdayAvg = (byWeekday[1] + byWeekday[2] + byWeekday[3] + byWeekday[4] + byWeekday[5]) / 5
    expect(byWeekday[0]).toBeLessThan(weekdayAvg * 0.8)
  })
})

describe('validateDemoInput', () => {
  it('keeps requests within limits', () => {
    expect(validateDemoInput({ saccoId: 's', vehicles: 8, days: 60 })).toBeNull()
    expect(validateDemoInput({ saccoId: '', vehicles: 8, days: 60 })).toMatch(/sacco/)
    expect(validateDemoInput({ saccoId: 's', vehicles: 40, days: 60 })).toMatch(/1 and 15/)
    expect(validateDemoInput({ saccoId: 's', vehicles: 8, days: 365 })).toMatch(/7 and 90/)
  })
})

// Minimal in-memory Supabase: enough for generateDemo / clearDemo.
function fakeDb(opts: { failFares?: boolean } = {}) {
  const tables: Record<string, any[]> = {
    saccos: [{ id: 's1' }],
    vehicles: [{ id: 'real-1', vehicle_code: 'KAB123B', sacco_id: 's1', is_demo: false }],
    transactions: [{ id: 't-real', vehicle_id: 'real-1', is_demo: false }],
  }
  let n = 0
  const from = (table: string) => {
    const filters: ((r: any) => boolean)[] = []
    let op: 'select' | 'insert' | 'delete' = 'select'
    let rows: any[] = []
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      insert: (r: any) => {
        op = 'insert'
        rows = (Array.isArray(r) ? r : [r]).map((x) => ({ id: `${table}-${++n}`, ...x }))
        return b
      },
      delete: () => ((op = 'delete'), b),
      maybeSingle: async () => ({ data: tables[table].find((r) => filters.every((f) => f(r))) ?? null }),
      then: (resolve: any) => {
        if (op === 'insert') {
          if (table === 'transactions' && opts.failFares) return resolve({ error: { message: 'db full' } })
          tables[table].push(...rows)
          return resolve({ data: rows, error: null })
        }
        const match = tables[table].filter((r) => filters.every((f) => f(r)))
        if (op === 'delete') {
          tables[table] = tables[table].filter((r) => !match.includes(r))
          return resolve({ error: null })
        }
        return resolve({ data: match, error: null })
      },
    }
    return b
  }
  return { supabase: { from } as any, tables }
}

describe('generateDemo and clearDemo', () => {
  it('adds unpayable demo matatus with history, then clears only demo rows', async () => {
    const { supabase, tables } = fakeDb()
    const res = await generateDemo(supabase, { saccoId: 's1', vehicles: 3, days: 7 }, seededRng(5))
    expect(res.vehicles).toHaveLength(3)
    expect(res.fares).toBeGreaterThan(0)
    const demo = tables.vehicles.filter((v) => v.is_demo)
    expect(demo).toHaveLength(3)
    for (const v of demo) {
      expect(v.lightning_address.endsWith(`@${DEMO_ADDRESS_DOMAIN}`)).toBe(true)
      expect(v.conductor_user_id).toBeUndefined()
    }

    expect(await clearDemo(supabase, 's1')).toEqual({ vehicles: 3 })
    expect(tables.vehicles.map((v) => v.id)).toEqual(['real-1'])
    expect(tables.transactions.map((t) => t.id)).toEqual(['t-real'])
  })

  it('removes the demo matatus again if saving fares fails', async () => {
    const { supabase, tables } = fakeDb({ failFares: true })
    await expect(generateDemo(supabase, { saccoId: 's1', vehicles: 2, days: 7 }, seededRng(6))).rejects.toThrow(/demo fares/)
    expect(tables.vehicles.map((v) => v.id)).toEqual(['real-1'])
  })
})
