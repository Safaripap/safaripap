// Signed daily report per vehicle, published to public Nostr relays. Ported
// from Nauli Sacco's lib/server/nostr.ts. Anyone can recompute the report's
// hash from the day's fare list (public at /api/verify, checked by /verify)
// to see that the sacco's numbers weren't changed after publishing.
// Demo vehicles and demo fares are never reported. Server-only.

import { supabaseAdmin } from './supabase-admin'
import { signAndPublish } from './nostr'
import { faresHash, reportEvent, type ReportFare } from './nostr-events'

const EAT_OFFSET_MS = 3 * 3600_000
const PAGE = 1000

export const isReportDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))

/** Nairobi calendar date (YYYY-MM-DD) of `d`, optionally `daysBack` days earlier. */
export function nairobiDate(d: Date = new Date(), daysBack = 0): string {
  return new Date(d.getTime() + EAT_OFFSET_MS - daysBack * 24 * 3600_000).toISOString().slice(0, 10)
}

/** Nairobi calendar date → UTC [from, to) bounds. */
export function dayBounds(date: string): { from: string; to: string } {
  const start = Date.parse(`${date}T00:00:00Z`) - EAT_OFFSET_MS
  return { from: new Date(start).toISOString(), to: new Date(start + 24 * 3600_000).toISOString() }
}

export interface ReportVehicle {
  id: string
  vehicle_code: string
  sacco_id: string | null
}

/** A vehicle's paid, non-demo fares on a Nairobi day, plus the sats the treasury settled for them. */
export async function dailyFares(vehicleId: string, date: string): Promise<{ fares: ReportFare[]; sats: number }> {
  const { from, to } = dayBounds(date)
  const fares: ReportFare[] = []
  let sats = 0
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, amount_kes, receipt_last3, status, amount_sats, settled_at')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'fulfilled')
      .eq('is_demo', false)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) {
      fares.push({ id: r.id, amount_kes: r.amount_kes, receipt_last3: r.receipt_last3 || null, status: r.status })
      if (r.settled_at) sats += r.amount_sats ?? 0
    }
    if (!data || data.length < PAGE) return { fares, sats }
  }
}

export interface DailyReport {
  vehicleCode: string
  date: string
  fares: number
  kes: number
  sats: number
  hash: string
  eventId: string
  relaysOk: string[]
}

export async function publishDailyReport(vehicle: ReportVehicle, date: string): Promise<DailyReport> {
  if (!isReportDate(date)) throw new Error('date must be YYYY-MM-DD')
  const { fares, sats } = await dailyFares(vehicle.id, date)
  const saccoId = vehicle.sacco_id ?? 'unassigned'
  const published = await signAndPublish(reportEvent({ vehicleCode: vehicle.vehicle_code, saccoId, date, fares, sats }))
  const hash = faresHash(fares)
  const kes = fares.reduce((s, f) => s + f.amount_kes, 0)

  const { error } = await supabaseAdmin.from('nostr_reports').upsert(
    {
      vehicle_id: vehicle.id,
      report_date: date,
      event_id: published.id,
      content_hash: hash,
      fares: fares.length,
      kes,
      sats,
    },
    { onConflict: 'vehicle_id,report_date' }
  )
  if (error) throw error
  return { vehicleCode: vehicle.vehicle_code, date, fares: fares.length, kes, sats, hash, eventId: published.id, relaysOk: published.relaysOk }
}

/** Publish a day's report for each vehicle; one vehicle failing doesn't stop the rest. */
export async function publishReports(vehicles: ReportVehicle[], date: string) {
  const reports: DailyReport[] = []
  const failures: { vehicleCode: string; error: string }[] = []
  for (const v of vehicles) {
    try {
      reports.push(await publishDailyReport(v, date))
    } catch (e) {
      failures.push({ vehicleCode: v.vehicle_code, error: (e as Error).message })
    }
  }
  return { date, reports, failures }
}

/** Every real (non-demo) vehicle, optionally in one sacco. */
export async function reportableVehicles(saccoId?: string): Promise<ReportVehicle[]> {
  let q = supabaseAdmin.from('vehicles').select('id, vehicle_code, sacco_id, is_demo').order('vehicle_code')
  if (saccoId) q = q.eq('sacco_id', saccoId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).filter((v) => !v.is_demo).map(({ id, vehicle_code, sacco_id }) => ({ id, vehicle_code, sacco_id }))
}
