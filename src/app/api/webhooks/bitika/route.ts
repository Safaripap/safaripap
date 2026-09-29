import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { publishPaymentEvent } from '@/lib/nostr'

// Bitika signs "<timestamp>.<raw body>" with your webhook secret (HMAC-SHA256).
// Header: X-Bitika-Signature: t=<ts>,v1=<hmac>
function verifyBitikaSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]))
  const { t, v1 } = parts
  if (!t || !v1) return false

  // Reject replays (5-minute window), per Bitika's docs.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false // length mismatch -> definitely not a match
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-bitika-signature')

  // Every webhook must be signed. Skipping the check when the header or secret
  // is missing would let anyone mark an unpaid fare as fulfilled.
  const secret = process.env.BITIKA_WEBHOOK_SECRET
  if (!secret) {
    console.error('BITIKA_WEBHOOK_SECRET is not set, rejecting webhook')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 })
  }
  if (!signatureHeader || !verifyBitikaSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  console.log('Bitika webhook event:', payload.event, payload.data)

  // The real payload wraps the transaction under `data` — confirmed from Bitika's docs.
  const { transaction_code, status, mpesa_receipt } = payload.data ?? {}
  if (!transaction_code) {
    return NextResponse.json({ error: 'missing transaction_code' }, { status: 400 })
  }

  const { data: txn, error } = await supabaseAdmin
    .from('transactions')
    .update({
      status,
      mpesa_receipt: mpesa_receipt ?? undefined,
      completed_at: status === 'fulfilled' ? new Date().toISOString() : undefined,
    })
    .eq('bitika_transaction_code', transaction_code)
    .select('*, vehicles(vehicle_code, sacco_id)')
    .single()

  if (error) {
    console.error('Failed to update transaction from webhook:', error)
    return NextResponse.json({ error: 'db update failed' }, { status: 500 })
  }

  if (status === 'fulfilled' && txn?.vehicles) {
    publishPaymentEvent({
      vehicleCode: txn.vehicles.vehicle_code,
      saccoId: txn.vehicles.sacco_id ?? 'unassigned',
      amountKes: txn.amount_kes,
      receiptCode: txn.mpesa_receipt ?? '',
    }).catch((err) => {
      console.error('Nostr publish failed (non-fatal):', err)
    })
  }

  return NextResponse.json({ ok: true })
}
