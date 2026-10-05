import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBalance } from '@/lib/lnbits-wallet'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('LNBITS_HOST', 'https://example.lnbits.com/')
})
afterEach(() => {
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('LNbits wallet API', () => {
  it("reads the same LNBITS_HOST as Safaripap's onboarding", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ balance: 2_500_999 })))
    await expect(getBalance('inkey')).resolves.toBe(2500)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.lnbits.com/api/v1/wallet')
    expect(init.headers['X-Api-Key']).toBe('inkey')
  })

  it('names LNBITS_HOST when it is missing', async () => {
    vi.stubEnv('LNBITS_HOST', '')
    await expect(getBalance('inkey')).rejects.toThrow('LNBITS_HOST')
  })
})

describe('LNbits responses that are not API answers', () => {
  it('reports the status and content type of an empty 200, instead of a schema error', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(getBalance('inkey')).rejects.toThrow('returned 200 with no JSON (content-type text/html, 0 bytes)')
  })
})
