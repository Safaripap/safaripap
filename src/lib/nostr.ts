// Nostr publishing — one app-wide keypair identifies your app as the publisher.
// Uses nostr-tools v2+ (generateSecretKey / getPublicKey / finalizeEvent / SimplePool).
// Older tutorials show generatePrivateKey/finishEvent/relayInit — that's the pre-v2
// API and does not mix with this one. package.json pins nostr-tools ^2.7.2.
// What the events contain lives in nostr-events.ts, shared with the browser.

import { getPublicKey, finalizeEvent } from 'nostr-tools/pure'
import { SimplePool } from 'nostr-tools/pool'
import { hexToBytes } from '@noble/hashes/utils'
import { supabaseAdmin } from './supabase-admin'
import { fareEvent, RELAYS, type EventTemplate, type FareEventInput } from './nostr-events'

export { RELAYS }

function getSecretKey(): Uint8Array {
  const hex = process.env.NOSTR_SECRET_KEY_HEX
  if (!hex) throw new Error('NOSTR_SECRET_KEY_HEX is not set — see scripts/gen-nostr-key.mjs')
  return hexToBytes(hex)
}

export function getAppPubkey(): string {
  return getPublicKey(getSecretKey())
}

const pool = new SimplePool()

export interface Published {
  id: string
  relaysOk: string[]
  relaysFailed: string[]
}

/** Sign and publish; succeeds if at least one relay accepted the event. */
export async function signAndPublish(template: EventTemplate, maxWait = 8000): Promise<Published> {
  const event = finalizeEvent(template, getSecretKey())
  const results = await Promise.allSettled(pool.publish(RELAYS, event, { maxWait }))
  const relaysOk = RELAYS.filter((_, i) => results[i]?.status === 'fulfilled')
  const relaysFailed = RELAYS.filter((_, i) => results[i]?.status !== 'fulfilled')
  if (!relaysOk.length) throw new Error(`No relay accepted the event (${relaysFailed.join(', ')})`)
  return { id: event.id, relaysOk, relaysFailed }
}

export type PaymentEventInput = FareEventInput

/** Publish a paid fare and record its event id on the fare, so a missed one can be retried. */
export async function publishPaymentEvent(input: PaymentEventInput): Promise<string> {
  const { id } = await signAndPublish(fareEvent(input))
  await supabaseAdmin.from('transactions').update({ nostr_event_id: id }).eq('id', input.txId)
  return id
}

// Publish, but never hold the caller up for more than `ms`. On Vercel a
// function can be frozen as soon as it responds, so a receipt that's
// fire-and-forget may never leave; waiting briefly gives it time, while a
// slow relay still can't delay the response for long. Never throws. A fare
// whose event didn't make it keeps nostr_event_id empty; the daily sweep
// publishes it again.
export async function publishPaymentEventSoon(input: PaymentEventInput, ms = 3000): Promise<void> {
  try {
    await Promise.race([publishPaymentEvent(input), new Promise((resolve) => setTimeout(resolve, ms))])
  } catch (err) {
    console.error('Nostr publish failed (non-fatal):', err)
  }
}
