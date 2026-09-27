import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { collectPayment } from '@/lib/bitika'
import { normalizePhoneNumber } from '@/lib/phone'

// Africa's Talking USSD webhook. No SDK needed to receive this — it's a plain
// form-encoded POST on every keypress. `phoneNumber` is supplied by the network,
// so the passenger never types their own number here.
// Point your Africa's Talking sandbox channel's callback URL at this route.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const phoneNumber = normalizePhoneNumber(String(form.get('phoneNumber') ?? ''))
  const text = String(form.get('text') ?? '')
  const parts = text.split('*').filter(Boolean)

  let response: string

  try {
    if (parts.length === 0) {
      response = 'CON Welcome to Matatu Pay\n1. Pay fare'
    } else if (parts.length === 1) {
      response = 'CON Enter the vehicle code (ask your conductor)'
    } else if (parts.length === 2) {
      const vehicleCode = parts[1].toUpperCase()
      const { data: vehicle } = await supabaseAdmin
        .from('vehicles')
        .select('*')
        .eq('vehicle_code', vehicleCode)
        .single()

      if (!vehicle) {
        response = 'END Vehicle code not found. Ask your conductor and try again.'
      } else if (vehicle.preset_fare_kes) {
        response = `CON Fare is KES ${vehicle.preset_fare_kes}\n1. Confirm\n2. Enter a different amount`
      } else {
        response = 'CON Enter the fare amount in KES'
      }
    } else {
      const vehicleCode = parts[1].toUpperCase()
      const { data: vehicle } = await supabaseAdmin
        .from('vehicles')
        .select('*')
        .eq('vehicle_code', vehicleCode)
        .single()

      let amountKes: number | null = null
      if (vehicle?.preset_fare_kes && parts[2] === '1') {
        amountKes = vehicle.preset_fare_kes
      } else if (vehicle?.preset_fare_kes && parts[2] === '2' && parts[3]) {
        amountKes = parseInt(parts[3], 10)
      } else if (!vehicle?.preset_fare_kes && parts[2]) {
        amountKes = parseInt(parts[2], 10)
      }

      if (vehicle && amountKes && amountKes >= 10) {
        const idempotencyKey = randomUUID()
        const bitikaRes = await collectPayment({
          amount: String(amountKes),
          phone: phoneNumber,
          lightningAddress: vehicle.lightning_address,
          idempotencyKey,
        })
        await supabaseAdmin.from('transactions').insert({
          vehicle_id: vehicle.id,
          amount_kes: amountKes,
          payer_phone: phoneNumber,
          bitika_transaction_code: bitikaRes.transaction_code,
          status: bitikaRes.status,
          source: 'ussd',
        })
        response =
          'END Payment request sent. Enter your M-Pesa PIN on the prompt on your phone to complete it. You will get an SMS confirmation.'
      } else if (vehicle?.preset_fare_kes && !amountKes) {
        response = 'CON Enter the fare amount in KES'
      } else {
        response = 'END Could not process that. Please dial in again.'
      }
    }
  } catch (err) {
    console.error('USSD handler error:', err)
    response = 'END Something went wrong. Please try again shortly.'
  }

  return new NextResponse(response, { headers: { 'Content-Type': 'text/plain' } })
}
