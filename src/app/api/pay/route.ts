import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { collectPayment } from '@/lib/bitika'
import { normalizePhoneNumber } from '@/lib/phone'

// Called by the passenger PWA once the passenger has entered vehicle code,
// amount and phone number. Never handles a PIN — Bitika's STK push triggers
// Safaricom's own PIN prompt on the passenger's phone, outside this app.
export async function POST(req: NextRequest) {
  const { vehicleCode, amountKes, phone: rawPhone } = await req.json()
  const phone = normalizePhoneNumber(rawPhone)

  if (!vehicleCode || !amountKes || !phone) {
    return NextResponse.json({ error: 'vehicleCode, amountKes and phone are required' }, { status: 400 })
  }

  const { data: vehicle, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', String(vehicleCode).toUpperCase())
    .single()

  if (error || !vehicle) {
    return NextResponse.json({ error: 'Unknown vehicle code' }, { status: 404 })
  }

  const idempotencyKey = randomUUID()

  try {
    const bitikaRes = await collectPayment({
      amount: String(amountKes),
      phone,
      lightningAddress: vehicle.lightning_address,
      idempotencyKey,
    })

    const { error: insertError } = await supabaseAdmin.from('transactions').insert({
      vehicle_id: vehicle.id,
      amount_kes: amountKes,
      payer_phone: phone,
      bitika_transaction_code: bitikaRes.transaction_code,
      status: bitikaRes.status,
      source: 'pwa',
    })
    if (insertError) throw insertError

    return NextResponse.json({ transactionCode: bitikaRes.transaction_code })
  } catch (err: any) {
    console.error('Payment initiation failed:', err)
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 502 })
  }
}
