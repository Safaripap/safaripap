// Tidies fares that didn't finish on their own, so no conductor's dashboard
// is left with a fare stuck on "Waiting…". Run by the daily cron and the
// admin sweep route. Each step only acts where the real outcome is known:
//   1. Daraja fares still 'processing' after a few minutes: ask Daraja (STK
//      query) and apply the answer. Still pending → left alone.
//   2. Paid Daraja fares the treasury hasn't settled (e.g. LNbits was down):
//      settle again. Never pays twice (see treasury.ts).
//   3. Paid fares whose Nostr event never reached a relay: publish again.
// Server-only.

import { supabaseAdmin } from './supabase-admin'
import { stkQuery } from './daraja'
import { applyStkOutcome } from './stk-outcome'
import { settleTransaction } from './treasury'
import { publishPaymentEvent } from './nostr'

const STUCK_AFTER_MS = 3 * 60_000 // the prompt times out long before this
const LOOKBACK_MS = 7 * 24 * 3600_000

export interface SweepResult {
  resolved: { id: string; status: string | null }[]
  stillPending: number
  settled: number
  republished: number
  errors: string[]
}

export async function sweep(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = { resolved: [], stillPending: 0, settled: 0, republished: 0, errors: [] }
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString()
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MS).toISOString()

  // 1. Stuck Daraja fares.
  const { data: stuck, error: e1 } = await supabaseAdmin
    .from('transactions')
    .select('id, daraja_checkout_id')
    .eq('status', 'processing')
    .not('daraja_checkout_id', 'is', null)
    .gte('created_at', since)
    .lt('created_at', stuckBefore)
  if (e1) result.errors.push(`load stuck fares: ${e1.message}`)
  for (const t of stuck ?? []) {
    try {
      const q = await stkQuery(t.daraja_checkout_id!)
      if (q.pending) {
        result.stillPending++
        continue
      }
      const applied = await applyStkOutcome({
        checkoutRequestId: t.daraja_checkout_id!,
        resultCode: q.resultCode,
        resultDesc: q.resultDesc,
        receipt: null,
      })
      result.resolved.push({ id: t.id, status: applied.status })
    } catch (e) {
      result.errors.push(`query ${t.id}: ${(e as Error).message}`)
    }
  }

  // 2. Paid but unsettled Daraja fares.
  const { data: unsettled, error: e2 } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('status', 'fulfilled')
    .not('daraja_checkout_id', 'is', null)
    .is('settled_at', null)
    .gte('created_at', since)
  if (e2) result.errors.push(`load unsettled fares: ${e2.message}`)
  for (const t of unsettled ?? []) {
    try {
      const r = await settleTransaction(t.id)
      if (r.ok) result.settled++
      else result.errors.push(`settle ${t.id}: ${r.reason}`)
    } catch (e) {
      result.errors.push(`settle ${t.id}: ${(e as Error).message}`)
    }
  }

  // 3. Paid fares missing their Nostr event.
  const { data: unpublished, error: e3 } = await supabaseAdmin
    .from('transactions')
    .select('id, amount_kes, is_demo, vehicles(vehicle_code, sacco_id)')
    .eq('status', 'fulfilled')
    .is('nostr_event_id', null)
    .gte('created_at', since)
  if (e3) result.errors.push(`load unpublished fares: ${e3.message}`)
  for (const t of (unpublished ?? []) as any[]) {
    if (!t.vehicles) continue
    try {
      await publishPaymentEvent({
        txId: t.id,
        vehicleCode: t.vehicles.vehicle_code,
        saccoId: t.vehicles.sacco_id ?? 'unassigned',
        amountKes: t.amount_kes,
        demo: t.is_demo || undefined,
      })
      result.republished++
    } catch (e) {
      result.errors.push(`publish ${t.id}: ${(e as Error).message}`)
    }
  }

  return result
}
