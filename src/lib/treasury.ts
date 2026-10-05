import { supabaseAdmin } from './supabase-admin'
import { createInvoice, getBalance, getPayment, payInvoice } from './lnbits-wallet'
import { kesToSats } from './pricing'

// Treasury settlement: once KES is received (tx 'fulfilled'), the pre-funded
// treasury wallet pays an invoice issued by the vehicle's wallet for the
// KES-equivalent sats.
//
// Never pay twice: the vehicle invoice's payment_hash is written to the tx
// (the "claim") before paying. A tx with a claim is only ever finished by
// asking LNbits whether that invoice got paid, or re-paying that same invoice.
//
// Ported from Nauli Sacco. Safaripap differences: only Daraja fares
// are settled here (Bitika pays the vehicle's Lightning Address itself), the
// vehicle's invoice key lives on vehicles.lnbits_invoice_key, and a settled
// fare keeps status 'fulfilled' with settled_at set, so every screen that
// reads 'fulfilled' as paid keeps working.

export type SettleResult = { ok: true; amountSats: number } | { ok: false; reason: string }

type SettleTx = {
  id: string
  status: string
  daraja_checkout_id: string | null
  settled_at: string | null
  amount_kes: number
  mpesa_receipt: string | null
  ln_payment_hash: string | null
  amount_sats: number | null
  vehicles: { vehicle_code: string; lnbits_invoice_key: string | null }
}

function treasuryAdminKey(): string {
  const key = process.env.LNBITS_TREASURY_ADMIN_KEY
  if (!key) throw new Error('server is missing LNBITS_TREASURY_ADMIN_KEY')
  return key
}

export async function settleTransaction(txId: string): Promise<SettleResult> {
  try {
    return await settle(txId)
  } catch (e) {
    // Record the error on the fare so it isn't lost with the function logs;
    // the fare stays 'fulfilled' and unsettled, ready to retry.
    const reason = `settlement_error: ${(e as Error).message}`.slice(0, 500)
    await supabaseAdmin.from('transactions').update({ failure_reason: reason }).eq('id', txId).is('settled_at', null)
    throw e
  }
}

async function settle(txId: string): Promise<SettleResult> {
  const db = supabaseAdmin
  const { data: tx, error } = await db
    .from('transactions')
    .select(
      'id, status, daraja_checkout_id, settled_at, amount_kes, mpesa_receipt, ln_payment_hash, amount_sats, vehicles!inner(vehicle_code, lnbits_invoice_key)'
    )
    .eq('id', txId)
    .maybeSingle<SettleTx>()
  if (error) throw error
  if (!tx) return { ok: false, reason: 'not_found' }
  if (!tx.daraja_checkout_id) return { ok: false, reason: 'not_daraja' } // Bitika already paid the vehicle
  if (tx.settled_at) return { ok: true, amountSats: tx.amount_sats ?? 0 }
  if (tx.status !== 'fulfilled') return { ok: false, reason: `status_${tx.status}` }

  const setReason = async (reason: string) => {
    await db.from('transactions').update({ failure_reason: reason }).eq('id', txId)
  }
  const releaseClaim = async (hash: string) => {
    await db.from('transactions').update({ ln_payment_hash: null }).eq('id', txId).eq('ln_payment_hash', hash)
  }
  const finalize = async (sats: number): Promise<SettleResult> => {
    const { error: upErr } = await db
      .from('transactions')
      .update({ settled_at: new Date().toISOString(), failure_reason: null })
      .eq('id', txId)
      .eq('status', 'fulfilled')
      .is('settled_at', null)
    if (upErr) throw upErr
    return { ok: true, amountSats: sats }
  }

  const vehicleKey = tx.vehicles.lnbits_invoice_key
  if (!vehicleKey) {
    await setReason('vehicle_wallet_missing')
    return { ok: false, reason: 'vehicle_wallet_missing' }
  }

  let bolt11: string
  let hash: string
  let sats: number

  if (tx.ln_payment_hash) {
    // An earlier attempt claimed this tx. Did its payment land?
    hash = tx.ln_payment_hash
    sats = tx.amount_sats ?? 0
    const p = await getPayment(vehicleKey, hash)
    if (p.paid) return finalize(sats)
    if (!p.bolt11) {
      await releaseClaim(hash)
      return { ok: false, reason: 'stale_claim_released' }
    }
    bolt11 = p.bolt11 // re-pay the same invoice: LNbits won't pay one hash twice
  } else {
    const priced = await kesToSats(tx.amount_kes)
    sats = priced.sats

    const treasurySats = await getBalance(treasuryAdminKey())
    if (treasurySats < sats) {
      // KES was received; leave 'fulfilled' so settlement can be retried after a top-up.
      await setReason('treasury_low')
      return { ok: false, reason: 'treasury_low' }
    }

    const memo = `Safaripap ${tx.vehicles.vehicle_code} fare ${tx.mpesa_receipt ?? tx.id.slice(0, 8)}`
    const invoice = await createInvoice(vehicleKey, sats, memo)
    bolt11 = invoice.bolt11
    hash = invoice.paymentHash

    const { data: claimed, error: claimErr } = await db
      .from('transactions')
      .update({ ln_payment_hash: hash, amount_sats: sats, btc_kes_rate: priced.rate })
      .eq('id', txId)
      .eq('status', 'fulfilled')
      .is('ln_payment_hash', null)
      .select('id')
    if (claimErr) throw claimErr
    if (!claimed?.length) return { ok: false, reason: 'already_claimed' }
  }

  try {
    await payInvoice(treasuryAdminKey(), bolt11)
  } catch (e) {
    // The pay call can fail after the payment went through (timeout). Ask before giving up.
    const after = await getPayment(vehicleKey, hash).catch(() => null)
    if (after?.paid) return finalize(sats)
    if (after) await releaseClaim(hash) // verified unpaid: next retry starts fresh
    await setReason(`settlement_failed: ${(e as Error).message}`.slice(0, 500))
    return { ok: false, reason: 'payment_failed' }
  }

  return finalize(sats)
}
