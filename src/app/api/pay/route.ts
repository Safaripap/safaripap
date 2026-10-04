import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { startCollection } from '@/lib/collect'
import { normalizePhoneNumber } from '@/lib/phone'
import { isDemoPhone, newDemoCode } from '@/lib/demo-phone'

// Called by the passenger PWA once the passenger has entered vehicle code,
// amount and phone number. Never handles a PIN — the STK push (Bitika, or
// Daraja if Bitika fails) triggers
// Safaricom's own PIN prompt on the passenger's phone, outside this app.
export async function POST(req: NextRequest) {
  const { vehicleCode, amountKes, phone: rawPhone } = await req.json()
  const phone = normalizePhoneNumber(rawPhone)

  if (!vehicleCode || !amountKes || !phone) {
    return NextResponse.json({ error: 'vehicleCode, amountKes and phone are required' }, { status: 400 })
  }
  if (!/^254[71]\d{8}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a Kenyan mobile number, like 0712 345 678' }, { status: 400 })
  }

  const { data: vehicle, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', String(vehicleCode).toUpperCase())
    .single()

  if (error || !vehicle) {
    return NextResponse.json({ error: 'Unknown vehicle code' }, { status: 404 })
  }
  // Demo matatus exist only to fill the sacco dashboard; they can't be paid.
  if (vehicle.is_demo) {
    return NextResponse.json({ error: 'This is a demo matatu and can’t take payments' }, { status: 404 })
  }

  // The demo phone never reaches Bitika; /api/transactions settles it shortly.
  if (isDemoPhone(phone)) {
    const transactionCode = newDemoCode()
    const { error: demoError } = await supabaseAdmin.from('transactions').insert({
      vehicle_id: vehicle.id,
      amount_kes: amountKes,
      payer_phone: phone,
      bitika_transaction_code: transactionCode,
      status: 'processing',
      source: 'pwa',
      is_demo: true,
    })
    if (demoError) return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 502 })
    return NextResponse.json({ transactionCode })
  }

  const idempotencyKey = randomUUID()

  try {
    // Bitika first; Daraja STK push if Bitika fails (see lib/collect.ts).
    const started = await startCollection({
      amountKes: Number(amountKes),
      phone,
      vehicleCode: vehicle.vehicle_code,
      lightningAddress: vehicle.lightning_address,
      idempotencyKey,
    })

    const providerFields =
      started.provider === 'bitika'
        ? { bitika_transaction_code: started.transactionCode, status: started.status }
        : {
            daraja_checkout_id: started.checkoutRequestId,
            daraja_merchant_request_id: started.merchantRequestId,
            status: 'processing',
          }
    const { error: insertError } = await supabaseAdmin.from('transactions').insert({
      vehicle_id: vehicle.id,
      amount_kes: amountKes,
      payer_phone: phone,
      source: 'pwa',
      ...providerFields,
    })
    if (insertError) {
      // The prompt is already on the phone; log enough to reconcile by hand.
      console.error(`STK sent via ${started.provider} but insert failed`, started, insertError)
      throw insertError
    }

    const transactionCode = started.provider === 'bitika' ? started.transactionCode : started.checkoutRequestId
    return NextResponse.json({ transactionCode, provider: started.provider })
  } catch (err: any) {
    console.error('Payment initiation failed:', err)
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 502 })
  }
}
