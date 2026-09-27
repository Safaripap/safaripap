// Bitika — the M-Pesa-to-sats collection leg.
// Docs (public): POST https://bitikaserver.up.railway.app/api/v1/xwift/collect
//
// Confirmed: bearer auth, amount in KES (10-10,000) as a string, phone in
// 254XXXXXXXXX format (no `+`, no leading 0), an idempotency key header, and a
// destination `lightningAddress` — point this at the vehicle's LNbits Lightning
// Address (see scripts/onboard-vehicle.ts), not at a one-off invoice, since Bitika
// runs the LNURL-pay flow itself against whatever amount the live FX rate implies.
//
// NOT fully confirmed from the public docs: the exact webhook JSON field names and
// the HMAC signature header name. Get a real sample payload from Bitika's dashboard
// or WhatsApp support (linked from bitika.xyz) on day 1-2 of the build and adjust
// app/api/webhooks/bitika/route.ts to match exactly.

const BITIKA_BASE = 'https://bitikaserver.up.railway.app/api/v1/xwift'

export interface CollectPaymentInput {
  amount: string // KES, "10" to "10000"
  phone: string // 254XXXXXXXXX
  lightningAddress: string // e.g. "KAB123B@legend.lnbits.com"
  idempotencyKey: string // fresh UUID per attempt
}

export interface CollectPaymentResponse {
  transaction_code: string
  status: string // 'processing' on success
}

export async function collectPayment(input: CollectPaymentInput): Promise<CollectPaymentResponse> {
  const apiKey = process.env.BITIKA_API_KEY
  if (!apiKey) throw new Error('BITIKA_API_KEY is not set')

  const res = await fetch(`${BITIKA_BASE}/collect`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      phone: input.phone,
      lightningAddress: input.lightningAddress,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bitika collect failed: ${res.status} ${body}`)
  }

  return res.json() as Promise<CollectPaymentResponse>
}
