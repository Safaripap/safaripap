import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// The PWA polls this every couple of seconds after initiating a payment, so it
// never talks to Bitika directly — it just reads our own DB, which the Bitika
// webhook keeps up to date.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('status, amount_kes, mpesa_receipt, phone_last3, receipt_last3')
    .eq('bitika_transaction_code', params.code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
