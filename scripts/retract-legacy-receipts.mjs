// Ask relays to delete Safaripap's old Nostr receipts (kind 1 'matatu-payment'
// notes from before 5 Oct 2026), which published full M-Pesa receipt numbers.
// Sends one NIP-09 deletion request (kind 5) signed by the app key. Relays
// that honour NIP-09 drop the notes; nothing can force every copy off the
// network, so this limits exposure rather than erasing it.
//
//   node scripts/retract-legacy-receipts.mjs            # list what would be retracted
//   node scripts/retract-legacy-receipts.mjs --publish  # send the deletion request
//
// Reads NOSTR_SECRET_KEY_HEX from .env. On a network where Node's connections
// time out, run with NODE_OPTIONS=--network-family-autoselection-attempt-timeout=3000.
import 'dotenv/config'
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { hexToBytes } from '@noble/hashes/utils'
import WebSocket from 'ws'

// A relay that times out makes ws emit 'error' after nostr-tools has given up
// on it; swallow that so one unreachable relay can't crash the script.
class QuietWebSocket extends WebSocket {
  constructor(...args) {
    super(...args)
    this.on('error', () => {})
  }
}
useWebSocketImplementation(QuietWebSocket)
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']
const publish = process.argv.includes('--publish')

const hex = process.env.NOSTR_SECRET_KEY_HEX
if (!hex) throw new Error('NOSTR_SECRET_KEY_HEX is not set')
const sk = hexToBytes(hex)
const pubkey = getPublicKey(sk)

const pool = new SimplePool()
const legacy = await pool.querySync(RELAYS, { kinds: [1], authors: [pubkey], '#t': ['matatu-payment'], limit: 1000 }, { maxWait: 8000 })
console.log(`${legacy.length} legacy receipt notes found`)
if (!legacy.length || !publish) {
  if (legacy.length) console.log('Dry run. Add --publish to send the deletion request.')
  pool.close(RELAYS)
  process.exit(0)
}

const deletion = finalizeEvent(
  {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...legacy.map((e) => ['e', e.id]), ['k', '1']],
    content: 'Retracted: these Safaripap receipts included full M-Pesa receipt numbers. Fares are now published without them.',
  },
  sk
)
const results = await Promise.allSettled(pool.publish(RELAYS, deletion))
RELAYS.forEach((r, i) => console.log(`${r}: ${results[i].status === 'fulfilled' ? 'accepted' : `failed (${results[i].reason})`}`))
pool.close(RELAYS)
process.exit(0)
