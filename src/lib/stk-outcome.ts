import { supabaseAdmin } from './supabase-admin'
import { settleTransaction } from './treasury'
import { publishPaymentEventSoon } from './nostr'

// One state machine for every way a Daraja STK result reaches us: the Daraja
// callback and the STK query fallback. Ported from Nauli Sacco; Safaripap
// keeps 'fulfilled' as the paid status (settlement is recorded in settled_at)
// and publishes the Nostr receipt the same way the Bitika webhook does.

export type StkOutcome = {
  checkoutRequestId: string
  resultCode: number
  resultDesc: string
  /** M-Pesa receipt. The callback has it; STK query does not. */
  receipt: string | null
}

export type ApplyResult = { txId: string | null; status: string | null; changed: boolean }

type TxRow = {
  id: string
  status: string
  amount_kes: number
  mpesa_receipt: string | null
  vehicles: { vehicle_code: string; sacco_id: string | null } | null
}

export async function applyStkOutcome(o: StkOutcome): Promise<ApplyResult> {
  const db = supabaseAdmin
  const { data: tx, error } = await db
    .from('transactions')
    .select('id, status, amount_kes, mpesa_receipt, vehicles(vehicle_code, sacco_id)')
    .eq('daraja_checkout_id', o.checkoutRequestId)
    .maybeSingle<TxRow>()
  if (error) throw error
  if (!tx) return { txId: null, status: null, changed: false }

  const now = new Date().toISOString()

  if (o.resultCode !== 0) {
    // Only a still-processing tx can fail; a late failure must not undo a success.
    const { data, error: upErr } = await db
      .from('transactions')
      .update({ status: 'failed', failure_reason: o.resultDesc || `ResultCode ${o.resultCode}`, completed_at: now })
      .eq('id', tx.id)
      .eq('status', 'processing')
      .select('id')
    if (upErr) throw upErr
    const changed = (data?.length ?? 0) > 0
    return { txId: tx.id, status: changed ? 'failed' : tx.status, changed }
  }

  // Success. Guarded on status so a duplicate callback is a no-op.
  const { data, error: upErr } = await db
    .from('transactions')
    .update({ status: 'fulfilled', mpesa_receipt: o.receipt, completed_at: now, failure_reason: null })
    .eq('id', tx.id)
    .eq('status', 'processing')
    .select('id')
  if (upErr) throw upErr
  const changed = (data?.length ?? 0) > 0

  // A success after we marked it failed means money may have moved: flag for manual reconciliation.
  if (!changed && tx.status === 'failed') {
    console.error(
      `RECONCILE: success (receipt ${o.receipt ?? 'none'}) for tx ${tx.id} already marked failed. CheckoutRequestID=${o.checkoutRequestId}`
    )
    return { txId: tx.id, status: tx.status, changed: false }
  }

  // STK query fulfils without a receipt; a callback arriving later fills it in.
  if (!changed && o.receipt && !tx.mpesa_receipt) {
    const { error: rErr } = await db
      .from('transactions')
      .update({ mpesa_receipt: o.receipt })
      .eq('id', tx.id)
      .is('mpesa_receipt', null)
    if (rErr) throw rErr
  }

  const status = changed ? 'fulfilled' : tx.status
  if (changed && tx.vehicles) {
    await publishPaymentEventSoon({
      txId: tx.id,
      vehicleCode: tx.vehicles.vehicle_code,
      saccoId: tx.vehicles.sacco_id ?? 'unassigned',
      amountKes: tx.amount_kes,
    })
  }
  if (status === 'fulfilled') {
    // Settlement failures never change what we tell Daraja or the passenger:
    // the KES was received; settlement can be retried.
    try {
      await settleTransaction(tx.id)
    } catch (e) {
      console.error(`settleTransaction(${tx.id}) failed:`, e)
    }
  }
  return { txId: tx.id, status, changed }
}
