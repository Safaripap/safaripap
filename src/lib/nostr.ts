// Nostr publishing — one app-wide keypair identifies your app as the publisher.
// Uses nostr-tools v2+ (generateSecretKey / getPublicKey / finalizeEvent / SimplePool).
// Older tutorials show generatePrivateKey/finishEvent/relayInit — that's the pre-v2
// API and does not mix with this one. package.json pins nostr-tools ^2.7.2.

import { getPublicKey, finalizeEvent } from 'nostr-tools/pure'
import { SimplePool } from 'nostr-tools/pool'
import { hexToBytes } from '@noble/hashes/utils'

export const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']

function getSecretKey(): Uint8Array {
  const hex = process.env.NOSTR_SECRET_KEY_HEX
  if (!hex) throw new Error('NOSTR_SECRET_KEY_HEX is not set — see scripts/gen-nostr-key.mjs')
  return hexToBytes(hex)
}

export function getAppPubkey(): string {
  return getPublicKey(getSecretKey())
}

const pool = new SimplePool()

export interface PaymentEventInput {
  vehicleCode: string
  saccoId: string
  amountKes: number
  receiptCode: string
}

export async function publishPaymentEvent(input: PaymentEventInput): Promise<string> {
  const sk = getSecretKey()

  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'matatu-payment'],
        ['vehicle', input.vehicleCode],
        ['sacco', input.saccoId],
      ],
      content: JSON.stringify({
        amount_kes: input.amountKes,
        vehicle: input.vehicleCode,
        receipt: input.receiptCode,
      }),
    },
    sk
  )

  await Promise.any(pool.publish(RELAYS, event))
  return event.id
}
