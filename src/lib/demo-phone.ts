// Demo phone: one phone number (DEMO_PHONE, e.g. 0727358159) that runs the
// whole pay flow without calling Bitika, for rehearsals and stage demos when
// real money or a reachable webhook isn't available. The fare is recorded as
// processing, then settles as paid a few seconds later, exactly as if Bitika's
// webhook had arrived, so the success screen and the conductor's dashboard
// behave as normal. No money or sats move, and the fare is flagged is_demo.
// Off unless DEMO_PHONE is set — unset it once the demo is over.
import { randomUUID } from 'crypto'
import { normalizePhoneNumber } from './phone'

export const DEMO_CODE_PREFIX = 'DEMO-'
export const DEMO_SETTLE_MS = 5000

export function isDemoPhone(phone: string): boolean {
  const demo = process.env.DEMO_PHONE
  return !!demo && normalizePhoneNumber(demo) === normalizePhoneNumber(phone)
}

export const isDemoCode = (code: string) => code.startsWith(DEMO_CODE_PREFIX)

export const newDemoCode = () => `${DEMO_CODE_PREFIX}${randomUUID().slice(0, 8).toUpperCase()}`

// A plausible-looking M-Pesa receipt, e.g. TDK4H7X9F3.
export function demoReceipt(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  return 'T' + Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
