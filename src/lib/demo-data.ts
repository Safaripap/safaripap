// Demo data for the sacco dashboard: placeholder matatus with a believable
// fare history. The generator is pure and seedable (tested); the database
// functions below write and clear it. Imports are relative so scripts can use it.
//
// Demo vehicles are flagged is_demo, never get a conductor login, and have a
// Lightning Address on the reserved .invalid domain, so even if a payment were
// somehow started for one, Bitika could not pay it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, dayKey } from './insights'

export const DEMO_LIMITS = { vehicles: { min: 1, max: 15 }, days: { min: 7, max: 90 } }
export const DEMO_ADDRESS_DOMAIN = 'demo.invalid'

export type Rng = () => number

// Small seedable PRNG (mulberry32), so tests are deterministic.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rng: Rng, xs: ArrayLike<T>): T => xs[Math.floor(rng() * xs.length)]
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ' // no I, O, Q: easy to misread on a plate
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
const CONDUCTORS = ['Brian Otieno', 'Kevin Mwangi', 'Dennis Kiprop', 'Collins Wafula', 'Peter Njoroge', 'Samuel Mutua', 'Joseph Omondi', 'Eric Kamau', 'Victor Cheruiyot', 'Ian Maina', 'Moses Wekesa', 'George Achieng', 'Felix Kibet', 'Daniel Ndungu', 'Allan Barasa']
const ROUTE_FARES = [50, 60, 70, 80, 100] as const

// A Kenyan-style plate, e.g. KDG214A, not already in `taken`.
export function demoPlate(rng: Rng, taken: Set<string>): string {
  for (;;) {
    const plate = `K${pick(rng, 'BCDE')}${pick(rng, LETTERS)}${int(rng, 100, 999)}${pick(rng, LETTERS)}`
    if (!taken.has(plate)) {
      taken.add(plate)
      return plate
    }
  }
}

export interface DemoVehicle {
  vehicle_code: string
  conductor_name: string
  preset_fare_kes: number
}

export function demoVehicles(rng: Rng, count: number, taken: Set<string>): DemoVehicle[] {
  return Array.from({ length: count }, (_, i) => ({
    vehicle_code: demoPlate(rng, taken),
    conductor_name: CONDUCTORS[i % CONDUCTORS.length],
    preset_fare_kes: pick(rng, ROUTE_FARES),
  }))
}

export interface DemoFare {
  vehicle_id: string
  amount_kes: number
  payer_phone: string
  mpesa_receipt: string
  status: 'fulfilled'
  verified_by_conductor: boolean
  verified_at: string | null
  source: 'pwa' | 'ussd'
  created_at: string
  completed_at: string
  is_demo: true
}

const EAT_OFFSET_MIN = 180

// Minute of the Nairobi day a fare happens: busy 6–9am and 4:30–7:30pm,
// steady in between, quiet late evening.
function fareMinute(rng: Rng): number {
  const r = rng()
  if (r < 0.35) return int(rng, 6 * 60, 9 * 60)
  if (r < 0.7) return int(rng, 16 * 60 + 30, 19 * 60 + 30)
  if (r < 0.92) return int(rng, 9 * 60, 16 * 60 + 30)
  return int(rng, 19 * 60 + 30, 21 * 60 + 30)
}

// Fares for each vehicle over the last `days` Nairobi days, ending `now`
// (nothing in the future). Weekdays are busiest, Sundays quietest, and each
// matatu has its own level of trade and the odd day off.
export function demoFares(
  rng: Rng,
  vehicles: { id: string; preset_fare_kes: number }[],
  days: number,
  now: Date = new Date()
): DemoFare[] {
  const today = dayKey(now)
  const nowMs = now.getTime()
  const out: DemoFare[] = []
  for (const v of vehicles) {
    const level = 22 + rng() * 20 // this matatu's typical weekday fares
    for (let d = days - 1; d >= 0; d--) {
      const day = addDays(today, -d)
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = Sunday
      if (rng() < 0.05) continue // day off / in the garage
      const factor = weekday === 0 ? 0.6 : weekday === 6 ? 0.85 : 1
      const count = Math.round(level * factor * (0.8 + rng() * 0.4))
      const dayStartUtc = Date.parse(`${day}T00:00:00Z`) - EAT_OFFSET_MIN * 60_000
      for (let k = 0; k < count; k++) {
        const at = dayStartUtc + fareMinute(rng) * 60_000 + int(rng, 0, 59) * 1000
        if (at > nowMs) continue
        const r = rng()
        const amount = r < 0.7 ? v.preset_fare_kes : Math.max(30, v.preset_fare_kes + pick(rng, [-20, -10, 10, 20]))
        const verified = rng() < 0.9
        out.push({
          vehicle_id: v.id,
          amount_kes: amount,
          payer_phone: `254${pick(rng, ['7', '1'])}${String(int(rng, 0, 99_999_999)).padStart(8, '0')}`,
          mpesa_receipt: `T${Array.from({ length: 9 }, () => pick(rng, ALNUM)).join('')}`,
          status: 'fulfilled',
          verified_by_conductor: verified,
          verified_at: verified ? new Date(at + int(rng, 30, 300) * 1000).toISOString() : null,
          source: rng() < 0.8 ? 'pwa' : 'ussd',
          created_at: new Date(at).toISOString(),
          completed_at: new Date(at + int(rng, 8, 40) * 1000).toISOString(),
          is_demo: true,
        })
      }
    }
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function validateDemoInput(input: { saccoId?: string; vehicles?: number; days?: number }): string | null {
  if (!input.saccoId) return 'Choose a sacco.'
  const { vehicles: V, days: D } = DEMO_LIMITS
  if (!Number.isInteger(input.vehicles) || input.vehicles! < V.min || input.vehicles! > V.max)
    return `Choose between ${V.min} and ${V.max} demo matatus.`
  if (!Number.isInteger(input.days) || input.days! < D.min || input.days! > D.max)
    return `Choose between ${D.min} and ${D.max} days of history.`
  return null
}

const BATCH = 500

// Adds demo matatus to a sacco and fills their history. On failure, removes
// whatever it added.
export async function generateDemo(
  supabase: SupabaseClient,
  input: { saccoId: string; vehicles: number; days: number },
  rng: Rng = Math.random
): Promise<{ vehicles: string[]; fares: number }> {
  const invalid = validateDemoInput(input)
  if (invalid) throw new Error(invalid)

  const { data: sacco } = await supabase.from('saccos').select('id').eq('id', input.saccoId).maybeSingle()
  if (!sacco) throw new Error('That sacco no longer exists.')

  const { data: existing } = await supabase.from('vehicles').select('vehicle_code')
  const taken = new Set<string>((existing ?? []).map((v: any) => v.vehicle_code))
  const planned = demoVehicles(rng, input.vehicles, taken)

  const { data: inserted, error } = await supabase
    .from('vehicles')
    .insert(
      planned.map((v) => ({
        ...v,
        sacco_id: input.saccoId,
        lnbits_wallet_id: 'demo',
        lnbits_invoice_key: 'demo',
        lightning_address: `${v.vehicle_code.toLowerCase()}@${DEMO_ADDRESS_DOMAIN}`,
        is_demo: true,
      }))
    )
    .select('id, vehicle_code, preset_fare_kes')
  if (error || !inserted) throw new Error(`Couldn't add demo matatus: ${error?.message}`)

  const ids = inserted.map((v: any) => v.id)
  try {
    const fares = demoFares(rng, inserted as any, input.days)
    for (let i = 0; i < fares.length; i += BATCH) {
      const { error: fareError } = await supabase.from('transactions').insert(fares.slice(i, i + BATCH))
      if (fareError) throw new Error(`Couldn't add demo fares: ${fareError.message}`)
    }
    return { vehicles: inserted.map((v: any) => v.vehicle_code), fares: fares.length }
  } catch (err) {
    await supabase.from('transactions').delete().in('vehicle_id', ids).eq('is_demo', true)
    await supabase.from('vehicles').delete().in('id', ids).eq('is_demo', true)
    throw err
  }
}

// Removes every demo matatu (and its fares) from a sacco. Real vehicles and
// real fares are never touched: both deletes are limited to is_demo rows.
export async function clearDemo(supabase: SupabaseClient, saccoId: string): Promise<{ vehicles: number }> {
  const { data: demo } = await supabase.from('vehicles').select('id').eq('sacco_id', saccoId).eq('is_demo', true)
  const ids = (demo ?? []).map((v: any) => v.id)
  if (!ids.length) return { vehicles: 0 }
  const { error: fareError } = await supabase.from('transactions').delete().in('vehicle_id', ids).eq('is_demo', true)
  if (fareError) throw new Error(`Couldn't remove demo fares: ${fareError.message}`)
  const { error } = await supabase.from('vehicles').delete().in('id', ids).eq('is_demo', true)
  if (error) throw new Error(`Couldn't remove demo matatus: ${error.message}`)
  return { vehicles: ids.length }
}
