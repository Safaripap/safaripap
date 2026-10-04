// Starting an M-Pesa collection for a fare: Bitika first, Daraja STK push if
// the Bitika call fails or errors. Bitika pays the vehicle's Lightning Address
// itself; a Daraja fare lands in the paybill and the treasury settles sats to
// the vehicle once Daraja confirms it (see stk-outcome.ts and treasury.ts).
import { collectPayment } from './bitika'
import { stkPush } from './daraja'

export interface CollectInput {
  amountKes: number
  phone: string // 254XXXXXXXXX
  vehicleCode: string
  lightningAddress: string
  idempotencyKey: string
}

export type CollectResult =
  | { provider: 'bitika'; transactionCode: string; status: string }
  | { provider: 'daraja'; checkoutRequestId: string; merchantRequestId: string }

export async function startCollection(input: CollectInput): Promise<CollectResult> {
  try {
    const res = await collectPayment({
      amount: String(input.amountKes),
      phone: input.phone,
      lightningAddress: input.lightningAddress,
      idempotencyKey: input.idempotencyKey,
    })
    return { provider: 'bitika', transactionCode: res.transaction_code, status: res.status }
  } catch (bitikaErr) {
    console.error('Bitika collect failed, falling back to Daraja:', bitikaErr)
  }
  // If Daraja fails too, its error propagates: the caller reports that no
  // prompt was sent.
  const stk = await stkPush({
    phone: input.phone,
    amount: input.amountKes,
    accountRef: input.vehicleCode,
    desc: 'Safaripap fare',
  })
  return { provider: 'daraja', checkoutRequestId: stk.checkoutRequestId, merchantRequestId: stk.merchantRequestId }
}

// A Bitika transaction code or a Daraja CheckoutRequestID (e.g.
// ws_CO_191220191020363925). Checked before either goes into a query filter.
export const isTransactionCode = (code: string) => /^[A-Za-z0-9_-]{1,100}$/.test(code)
