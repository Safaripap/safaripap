// Starting an M-Pesa collection for a fare, the way Nauli Sacco does it:
// a Daraja STK push to the passenger's phone. The fare lands in our paybill;
// Daraja's callback (or the STK query fallback) marks it paid and records the
// M-Pesa receipt, and the LNbits treasury then pays the vehicle's wallet the
// equivalent sats (see stk-outcome.ts and treasury.ts).
//
// Bitika is switched off for now: its sandbox accepts requests but never
// prompts the phone or confirms, so fares stuck at 'processing'. The client
// (bitika.ts) and webhook (api/webhooks/bitika) are kept. To bring Bitika
// back as the primary route with Daraja as fallback, uncomment the block in
// startCollection below.
// import { collectPayment } from './bitika'
import { stkPush } from './daraja'

export interface CollectInput {
  amountKes: number
  phone: string // 254XXXXXXXXX
  vehicleCode: string
  lightningAddress: string // only used by Bitika
  idempotencyKey: string // only used by Bitika
}

export type CollectResult =
  | { provider: 'bitika'; transactionCode: string; status: string }
  | { provider: 'daraja'; checkoutRequestId: string; merchantRequestId: string }

export async function startCollection(input: CollectInput): Promise<CollectResult> {
  // Bitika (disabled): primary route, with Daraja as the fallback below.
  // try {
  //   const res = await collectPayment({
  //     amount: String(input.amountKes),
  //     phone: input.phone,
  //     lightningAddress: input.lightningAddress,
  //     idempotencyKey: input.idempotencyKey,
  //   })
  //   return { provider: 'bitika', transactionCode: res.transaction_code, status: res.status }
  // } catch (bitikaErr) {
  //   console.error('Bitika collect failed, falling back to Daraja:', bitikaErr)
  // }

  // If Daraja fails, its error propagates: the caller reports that no prompt
  // was sent and no money was taken.
  const stk = await stkPush({
    phone: input.phone,
    amount: input.amountKes,
    accountRef: input.vehicleCode,
    desc: 'Safaripap fare',
  })
  return { provider: 'daraja', checkoutRequestId: stk.checkoutRequestId, merchantRequestId: stk.merchantRequestId }
}

/** The transactions columns that record a started collection. */
export function collectionFields(started: CollectResult) {
  return started.provider === 'bitika'
    ? { bitika_transaction_code: started.transactionCode, status: started.status }
    : {
        daraja_checkout_id: started.checkoutRequestId,
        daraja_merchant_request_id: started.merchantRequestId,
        status: 'processing',
      }
}

/** What the pay page polls with: the Bitika code or the Daraja CheckoutRequestID. */
export const transactionCodeOf = (started: CollectResult) =>
  started.provider === 'bitika' ? started.transactionCode : started.checkoutRequestId

// A Bitika transaction code or a Daraja CheckoutRequestID (e.g.
// ws_CO_191220191020363925). Checked before either goes into a query filter.
export const isTransactionCode = (code: string) => /^[A-Za-z0-9_-]{1,100}$/.test(code)
