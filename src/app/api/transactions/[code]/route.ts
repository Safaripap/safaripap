import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEMO_SETTLE_MS, demoReceipt, isDemoCode } from '@/lib/demo-phone'
import { publishPaymentEventSoon } from '@/lib/nostr'
import { isTransactionCode } from '@/lib/collect'

// The PWA polls this every couple of seconds after initiating a payment, so it
// never talks to Bitika or Daraja directly — it just reads our own DB, which
// the Bitika webhook and the Daraja callback keep up to date. `code` is the
// Bitika transaction code or, for a Daraja fare, its CheckoutRequestID.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  if (!isTransactionCode(params.code)) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('status, amount_kes, mpesa_receipt, phone_last3, receipt_last3, created_at')
    .or(`bitika_transaction_code.eq.${params.code},daraja_checkout_id.eq.${params.code}`)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // A demo-phone fare settles a few seconds after it starts, standing in for
  // Bitika's webhook. Only rows flagged is_demo are ever touched here.
  if (isDemoCode(params.code) && data.status === 'processing' && Date.now() - Date.parse(data.created_at) >= DEMO_SETTLE_MS) {
    const { data: settled } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'fulfilled', mpesa_receipt: demoReceipt(), completed_at: new Date().toISOString() })
      .eq('bitika_transaction_code', params.code)
      .eq('is_demo', true)
      .eq('status', 'processing')
      .select('id, status, amount_kes, mpesa_receipt, phone_last3, receipt_last3, vehicles(vehicle_code, sacco_id)')
      .maybeSingle()
    if (settled) {
      // Publish the fare like a real payment does, so the sacco totals page
      // (which reads Nostr) picks up demo fares too, marked as demo.
      const { vehicles, id, ...fare } = settled as any
      if (vehicles) {
        await publishPaymentEventSoon({
          txId: id,
          vehicleCode: vehicles.vehicle_code,
          saccoId: vehicles.sacco_id ?? 'unassigned',
          amountKes: fare.amount_kes,
          demo: true,
        })
      }
      return NextResponse.json(fare)
    }
  }

  const { created_at: _createdAt, ...publicFields } = data
  return NextResponse.json(publicFields)
}
