import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callbackUrl, nairobiTimestamp, parseCallback, stkPassword, stkPush } from '@/lib/daraja'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('DARAJA_BASE_URL', 'https://sandbox.example.com/')
  vi.stubEnv('DARAJA_CONSUMER_KEY', 'ck')
  vi.stubEnv('DARAJA_CONSUMER_SECRET', 'cs')
  vi.stubEnv('DARAJA_SHORTCODE', '174379')
  vi.stubEnv('DARAJA_PASSKEY', 'pk')
  vi.stubEnv('DARAJA_CALLBACK_BASE_URL', 'https://safaripap.example/')
  vi.stubEnv('DARAJA_CALLBACK_TOKEN', 'tok en')
})
afterEach(() => {
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('Daraja helpers', () => {
  it('formats the timestamp in Nairobi time, not UTC', () => {
    expect(nairobiTimestamp(new Date('2026-10-04T21:30:05Z'))).toBe('20261005003005')
  })

  it('builds the STK password as base64(shortcode + passkey + timestamp)', () => {
    expect(Buffer.from(stkPassword('174379', 'pk', '20261005003005'), 'base64').toString()).toBe(
      '174379pk20261005003005'
    )
  })

  it('appends the encoded callback token to the callback URL', () => {
    expect(callbackUrl()).toBe('https://safaripap.example/api/hooks/payment-result?token=tok%20en')
  })
})

describe('stkPush', () => {
  it('fetches a token, then sends the STK push', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'T', expires_in: '3599' }))
      .mockResolvedValueOnce(
        json({ MerchantRequestID: 'm1', CheckoutRequestID: 'ws_CO_1', ResponseCode: '0', CustomerMessage: 'ok' })
      )
    await expect(
      stkPush({ phone: '254712345678', amount: 50, accountRef: 'KAB123B', desc: 'Safaripap fare' })
    ).resolves.toEqual({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm1', customerMessage: 'ok' })
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://sandbox.example.com/mpesa/stkpush/v1/processrequest')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ Amount: 50, PartyA: '254712345678', AccountReference: 'KAB123B' })
    expect(body.TransactionDesc).toBe('Safaripap far') // Daraja caps it at 13 characters
  })

  it('throws when Daraja rejects the push', async () => {
    // The token from the previous test is cached, so only the push is fetched.
    fetchMock.mockResolvedValueOnce(json({ errorCode: '400.002.02', errorMessage: 'Bad Request - Invalid Amount' }, 400))
    await expect(stkPush({ phone: '254712345678', amount: 50, accountRef: 'K', desc: 'd' })).rejects.toThrow(
      'Invalid Amount'
    )
  })

  it('refuses a non-integer amount without calling Daraja', async () => {
    await expect(stkPush({ phone: '254712345678', amount: 0.5, accountRef: 'K', desc: 'd' })).rejects.toThrow(
      'positive integer'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('parseCallback', () => {
  it('reads the receipt and amount from a successful callback', () => {
    const cb = parseCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'm1',
          CheckoutRequestID: 'ws_CO_1',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 50 },
              { Name: 'MpesaReceiptNumber', Value: 'TDK4H7X9F3' },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    })
    expect(cb).toMatchObject({ checkoutRequestId: 'ws_CO_1', resultCode: 0, receipt: 'TDK4H7X9F3', amount: 50 })
  })

  it('has no receipt when the passenger cancels', () => {
    const cb = parseCallback({
      Body: {
        stkCallback: { MerchantRequestID: 'm1', CheckoutRequestID: 'ws_CO_1', ResultCode: 1032, ResultDesc: 'Cancelled' },
      },
    })
    expect(cb).toMatchObject({ resultCode: 1032, receipt: null })
  })
})
