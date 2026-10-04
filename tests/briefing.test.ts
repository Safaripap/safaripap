import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    constructor(public status?: number) {
      super('api error')
    }
  }
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError
    static AuthenticationError = AuthenticationError
    static RateLimitError = RateLimitError
    beta = { messages: { create: sdk.create } }
  }
  return { default: Anthropic }
})

import { briefingEnabled, getBriefing, numericSummary } from '@/lib/briefing'
import { buildForecast } from '@/lib/forecast'

const NOW = new Date('2026-10-04T07:30:00Z')
const forecastFor = (codes: string[]) =>
  buildForecast({
    saccoId: 's1',
    saccoName: 'Super Metro',
    vehicles: codes.map((c, i) => ({ id: `v${i}`, vehicle_code: c })),
    history: [{ vehicle_id: 'v0', amount_kes: 400, created_at: '2026-09-28T05:00:00Z' }],
    today: [],
    now: NOW,
  })
const reply = (text: string, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }] })

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
  sdk.create.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('AI forecast summary', () => {
  it('is off without ANTHROPIC_API_KEY and never calls Claude', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(briefingEnabled()).toBe(false)
    await expect(getBriefing(forecastFor(['KAB123B']))).resolves.toBeNull()
    expect(sdk.create).not.toHaveBeenCalled()
  })

  it('sends only aggregates: no phone numbers, receipts or vehicle ids', () => {
    const summary = JSON.stringify(numericSummary(forecastFor(['KAB123B'])))
    expect(summary).toContain('KAB123B')
    expect(summary).not.toMatch(/254\d{9}|receipt|v0|vehicle_id/i)
  })

  it('asks Claude Opus 5.5 at low effort with refusal fallbacks, and caches the answer', async () => {
    sdk.create.mockResolvedValue(reply('Tomorrow looks steady.'))
    const f = forecastFor(['KCA111A'])
    await expect(getBriefing(f)).resolves.toBe('Tomorrow looks steady.')
    await expect(getBriefing(f)).resolves.toBe('Tomorrow looks steady.')
    expect(sdk.create).toHaveBeenCalledTimes(1)
    expect(sdk.create.mock.calls[0][0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
    })
  })

  it("doesn't serve one owner's summary to another owner in the same sacco", async () => {
    sdk.create.mockResolvedValueOnce(reply('About KCB222B.')).mockResolvedValueOnce(reply('About KCC333C.'))
    await expect(getBriefing(forecastFor(['KCB222B']))).resolves.toBe('About KCB222B.')
    await expect(getBriefing(forecastFor(['KCC333C']))).resolves.toBe('About KCC333C.')
  })

  it('returns nothing on a refusal or an API error', async () => {
    sdk.create.mockResolvedValueOnce(reply('', 'refusal'))
    await expect(getBriefing(forecastFor(['KCD444D']))).resolves.toBeNull()
    sdk.create.mockRejectedValueOnce(new Error('network'))
    await expect(getBriefing(forecastFor(['KCE555E']))).resolves.toBeNull()
  })
})
