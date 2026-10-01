import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWallet } from '@/lib/lnbits'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('LNBITS_HOST', 'https://example.lnbits.com/')
  vi.stubEnv('LNBITS_ACCESS_TOKEN', '')
  vi.stubEnv('LNBITS_USER_ID', '')
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'w1', name: 'KAB fares', adminkey: 'a', inkey: 'i' })))
})
afterEach(() => {
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('createWallet', () => {
  it('uses the account access token as a bearer token when set', async () => {
    vi.stubEnv('LNBITS_ACCESS_TOKEN', 'tok')
    await createWallet('KAB fares')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.lnbits.com/api/v1/wallet')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ name: 'KAB fares' })
  })

  it('falls back to the account user ID as ?usr=', async () => {
    vi.stubEnv('LNBITS_USER_ID', 'user 1')
    await createWallet('KAB fares')
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.lnbits.com/api/v1/wallet?usr=user%201')
  })

  it('explains what to set when neither is configured, without calling LNbits', async () => {
    await expect(createWallet('KAB fares')).rejects.toThrow(/LNBITS_ACCESS_TOKEN/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces LNbits' error detail", async () => {
    vi.stubEnv('LNBITS_USER_ID', 'wrong')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Missing user ID or access token.' }), { status: 401 })
    )
    await expect(createWallet('KAB fares')).rejects.toThrow('(401): Missing user ID or access token.')
  })
})
