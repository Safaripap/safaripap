import { beforeEach, describe, expect, it, vi } from 'vitest'

const published = vi.hoisted(() => [] as any[])
vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    publish(_relays: string[], event: any) {
      published.push(event)
      return [Promise.resolve('ok')]
    }
  },
}))

import { publishPaymentEvent, publishPaymentEventSoon } from '@/lib/nostr'

beforeEach(() => {
  published.length = 0
  vi.stubEnv('NOSTR_SECRET_KEY_HEX', '1'.repeat(64))
})

const input = { vehicleCode: 'KAB123B', saccoId: 's1', amountKes: 50, receiptCode: 'TDK4H7X9F3' }

describe('Nostr receipts', () => {
  it('publishes a real fare without any demo marker', async () => {
    await publishPaymentEvent(input)
    const e = published[0]
    expect(e.tags).toEqual([['t', 'matatu-payment'], ['vehicle', 'KAB123B'], ['sacco', 's1']])
    expect(JSON.parse(e.content)).toEqual({ amount_kes: 50, vehicle: 'KAB123B', receipt: 'TDK4H7X9F3' })
  })

  it('tags demo fares in both the tags and the content', async () => {
    await publishPaymentEvent({ ...input, demo: true })
    const e = published[0]
    expect(e.tags).toContainEqual(['demo', 'true'])
    expect(JSON.parse(e.content).demo).toBe(true)
  })

  it('never throws, even if the key is missing', async () => {
    vi.stubEnv('NOSTR_SECRET_KEY_HEX', '')
    await expect(publishPaymentEventSoon(input)).resolves.toBeUndefined()
  })
})
