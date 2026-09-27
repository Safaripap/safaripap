// One-off: generates the app's Nostr keypair. Run with `node scripts/gen-nostr-key.mjs`,
// then copy the two printed values into your .env file. Run this ONCE — regenerating
// changes the app's public identity on every relay.
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { bytesToHex } from '@noble/hashes/utils'

const sk = generateSecretKey()
const pk = getPublicKey(sk)

console.log('NOSTR_SECRET_KEY_HEX=' + bytesToHex(sk))
console.log('NEXT_PUBLIC_NOSTR_APP_PUBKEY=' + pk)
