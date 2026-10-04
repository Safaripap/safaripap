import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ collectPayment: vi.fn(), stkPush: vi.fn() }))
vi.mock('@/lib/bitika', () => ({ collectPayment: mocks.collectPayment }))
vi.mock('@/lib/daraja', () => ({ stkPush: mocks.stkPush }))

import { isTransactionCode, startCollection } from '@/lib/collect'

const input = {
  amountKes: 50,
  phone: '254712345678',
  vehicleCode: 'KAB123B',
  lightningAddress: 'kab123b@example.lnbits.com',
  idempotencyKey: 'idem-1',
}

beforeEach(() => {
  mocks.collectPayment.mockReset()
  mocks.stkPush.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('startCollection', () => {
  it('uses Bitika when it succeeds, and never calls Daraja', async () => {
    mocks.collectPayment.mockResolvedValue({ transaction_code: 'BTK1', status: 'processing' })
    await expect(startCollection(input)).resolves.toEqual({
      provider: 'bitika',
      transactionCode: 'BTK1',
      status: 'processing',
    })
    expect(mocks.collectPayment).toHaveBeenCalledWith({
      amount: '50',
      phone: '254712345678',
      lightningAddress: 'kab123b@example.lnbits.com',
      idempotencyKey: 'idem-1',
    })
    expect(mocks.stkPush).not.toHaveBeenCalled()
  })

  it('falls back to a Daraja STK push when Bitika errors', async () => {
    mocks.collectPayment.mockRejectedValue(new Error('Bitika collect failed: 503'))
    mocks.stkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1', customerMessage: '' })
    await expect(startCollection(input)).resolves.toEqual({
      provider: 'daraja',
      checkoutRequestId: 'ws_CO_1',
      merchantRequestId: 'm-1',
    })
    expect(mocks.stkPush).toHaveBeenCalledWith({
      phone: '254712345678',
      amount: 50,
      accountRef: 'KAB123B',
      desc: 'Safaripap fare',
    })
  })

  it('falls back when Bitika is not configured at all', async () => {
    mocks.collectPayment.mockRejectedValue(new Error('BITIKA_API_KEY is not set'))
    mocks.stkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_2', merchantRequestId: 'm-2', customerMessage: '' })
    expect((await startCollection(input)).provider).toBe('daraja')
  })

  it('fails when both Bitika and Daraja fail', async () => {
    mocks.collectPayment.mockRejectedValue(new Error('down'))
    mocks.stkPush.mockRejectedValue(new Error('Daraja down too'))
    await expect(startCollection(input)).rejects.toThrow('Daraja down too')
  })
})

describe('isTransactionCode', () => {
  it('accepts Bitika codes and Daraja checkout IDs', () => {
    expect(isTransactionCode('BTK123')).toBe(true)
    expect(isTransactionCode('ws_CO_191220191020363925')).toBe(true)
    expect(isTransactionCode('DEMO-1A2B3C4D')).toBe(true)
  })

  it('rejects anything that could change a query filter', () => {
    expect(isTransactionCode('a,status.eq.fulfilled')).toBe(false)
    expect(isTransactionCode('a.b')).toBe(false)
    expect(isTransactionCode('')).toBe(false)
  })
})
