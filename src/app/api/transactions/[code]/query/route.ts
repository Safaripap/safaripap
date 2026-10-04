import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DarajaError, stkQuery } from '@/lib/daraja'
import { applyStkOutcome } from '@/lib/stk-outcome'
import { isTransactionCode } from '@/lib/collect'

// STK query fallback for when the Daraja callback never arrives (common in
// the sandbox). Ported from Nauli Sacco. Only Daraja-fallback fares have
// anything to ask; Bitika fares just report their current status.
export async function POST(_req: NextRequest, { params }: { params: { code: string } }) {
  if (!isTransactionCode(params.code)) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const { data: tx, error } = await supabaseAdmin
    .from('transactions')
    .select('id, status, daraja_checkout_id')
    .eq('daraja_checkout_id', params.code)
    .maybeSingle<{ id: string; status: string; daraja_checkout_id: string | null }>()
  if (error) return NextResponse.json({ error: 'Could not load transaction' }, { status: 500 })
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  if (tx.status !== 'processing' || !tx.daraja_checkout_id) {
    return NextResponse.json({ status: tx.status, pending: false })
  }

  try {
    const q = await stkQuery(tx.daraja_checkout_id)
    if (q.pending) return NextResponse.json({ status: 'processing', pending: true })
    const result = await applyStkOutcome({
      checkoutRequestId: tx.daraja_checkout_id,
      resultCode: q.resultCode,
      resultDesc: q.resultDesc,
      receipt: null,
    })
    return NextResponse.json({ status: result.status, pending: false, resultDesc: q.resultDesc })
  } catch (e) {
    const message = e instanceof DarajaError ? e.message : 'M-Pesa is not responding'
    console.error(`tx query ${tx.id} failed`, e)
    return NextResponse.json({ error: `Status check failed: ${message}`, status: tx.status }, { status: 502 })
  }
}
