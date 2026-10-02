import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEMO_SETTLE_MS, demoReceipt, isDemoCode } from '@/lib/demo-phone'
import { publishPaymentEventSoon } from '@/lib/nostr'

// The PWA polls this every couple of seconds after initiating a payment, so it
// never talks to Bitika directly — it just reads our own DB, which the Bitika
// webhook keeps up to date.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('status, amount_kes, mpesa_receipt, phone_last3, receipt_last3, created_at')
    .eq('bitika_transaction_code', params.code)
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
      .select('status, amount_kes, mpesa_receipt, phone_last3, receipt_last3, vehicles(vehicle_code, sacco_id)')
      .maybeSingle()
    if (settled) {
      // Publish the receipt like the webhook does, so the conductors' sacco
      // totals page (which reads Nostr) picks up demo fares too.
      const { vehicles, ...fare } = settled as any
      if (vehicles) {
        await publishPaymentEventSoon({
          vehicleCode: vehicles.vehicle_code,
          saccoId: vehicles.sacco_id ?? 'unassigned',
          amountKes: fare.amount_kes,
          receiptCode: fare.mpesa_receipt ?? '',
          demo: true,
        })
      }
      return NextResponse.json(fare)
    }
  }

  const { created_at: _createdAt, ...publicFields } = data
  return NextResponse.json(publicFields)
}
