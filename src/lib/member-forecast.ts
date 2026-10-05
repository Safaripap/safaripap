// Builds the forecast for a signed-in manager (whole sacco) or owner (their
// matatus). Shared by the forecast route and the AI summary route. Server-only.
import { supabaseAdmin } from './supabase-admin'
import { buildForecast, fetchPaidFares, forecastWindows, type SaccoForecast } from './forecast'
import type { Member } from './members'

export async function forecastForMember(member: Member, now: Date = new Date()): Promise<SaccoForecast> {
  const ids = member.vehicles.map((v) => v.id)
  const names = new Map<string, string | null>()
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('vehicles').select('id, conductor_name').in('id', ids)
    if (error) throw error
    for (const v of data ?? []) names.set(v.id, v.conductor_name)
  }

  const w = forecastWindows(now)
  const [history, today] = await Promise.all([
    fetchPaidFares(supabaseAdmin, ids, w.history.from, w.history.to),
    fetchPaidFares(supabaseAdmin, ids, w.today.from, w.today.to),
  ])
  return buildForecast({
    saccoId: member.saccoId,
    saccoName: member.saccoName,
    vehicles: member.vehicles.map((v) => ({ ...v, conductor_name: names.get(v.id) ?? null })),
    history,
    today,
    now,
  })
}
