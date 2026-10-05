import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ published: [] as any[], accept: true, updates: [] as any[] }))
vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    publish(relays: string[], event: any) {
      state.published.push(event)
      return relays.map(() => (state.accept ? Promise.resolve('ok') : Promise.reject(new Error('blocked'))))
    }
  },
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const b: any = {
        update: (patch: any) => ({ eq: async (_c: string, id: string) => (state.updates.push({ patch, id }), { error: null }) }),
      }
      return b
    },
  },
}))

import { publishPaymentEvent, publishPaymentEventSoon, signAndPublish } from '@/lib/nostr'
import { verifyEvent } from 'nostr-tools/pure'

beforeEach(() => {
  state.published.length = 0
  state.updates.length = 0
  state.accept = true
  vi.stubEnv('NOSTR_SECRET_KEY_HEX', '1'.repeat(64))
})

const input = { txId: 't1', vehicleCode: 'KAB123B', saccoId: 's1', amountKes: 50 }

describe('publishing a paid fare', () => {
  it('signs a NIP-78 fare event with no receipt or phone digits', async () => {
    await publishPaymentEvent(input)
    const e = state.published[0]
    expect(verifyEvent(e)).toBe(true)
    expect(e.kind).toBe(30078)
    expect(e.tags).toEqual([['d', 'safaripap:fare:t1'], ['t', 'safaripap-fare'], ['vehicle', 'KAB123B'], ['sacco', 's1']])
    expect(JSON.parse(e.content)).toEqual({ amount_kes: 50, vehicle: 'KAB123B' })
    expect(JSON.stringify(e)).not.toMatch(/receipt/i)
  })

  it('records the event id on the fare, so a missed one can be found and re-sent', async () => {
    const id = await publishPaymentEvent(input)
    expect(state.updates).toEqual([{ patch: { nostr_event_id: id }, id: 't1' }])
  })

  it('tags demo fares in both the tags and the content', async () => {
    await publishPaymentEvent({ ...input, demo: true })
    const e = state.published[0]
    expect(e.tags).toContainEqual(['demo', 'true'])
    expect(JSON.parse(e.content).demo).toBe(true)
  })

  it('fails, and records nothing, when no relay accepts the event', async () => {
    state.accept = false
    await expect(signAndPublish({ kind: 30078, created_at: 1, tags: [], content: '' })).rejects.toThrow('No relay accepted')
    await expect(publishPaymentEvent(input)).rejects.toThrow()
    expect(state.updates).toEqual([])
  })

  it('never throws from the background publish, even if the key is missing', async () => {
    vi.stubEnv('NOSTR_SECRET_KEY_HEX', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(publishPaymentEventSoon(input)).resolves.toBeUndefined()
  })
})
