import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ collectPayment: vi.fn(), stkPush: vi.fn() }))
vi.mock('@/lib/bitika', () => ({ collectPayment: mocks.collectPayment }))
vi.mock('@/lib/daraja', () => ({ stkPush: mocks.stkPush }))

import { collectionFields, isTransactionCode, startCollection, transactionCodeOf } from '@/lib/collect'

const input = {
  amountKes: 1,
  phone: '254712345678',
  vehicleCode: 'KAB123B',
  lightningAddress: 'kab123b@example.lnbits.com',
  idempotencyKey: 'idem-1',
}

beforeEach(() => {
  mocks.collectPayment.mockReset()
  mocks.stkPush.mockReset()
})

describe('startCollection', () => {
  it('sends a Daraja STK push, as Nauli Sacco does', async () => {
    mocks.stkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1', customerMessage: '' })
    const started = await startCollection(input)
    expect(started).toEqual({ provider: 'daraja', checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1' })
    expect(mocks.stkPush).toHaveBeenCalledWith({
      phone: '254712345678',
      amount: 1,
      accountRef: 'KAB123B',
      desc: 'Safaripap fare',
    })
  })

  it('never calls Bitika while it is switched off', async () => {
    mocks.stkPush.mockResolvedValue({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1', customerMessage: '' })
    await startCollection(input)
    expect(mocks.collectPayment).not.toHaveBeenCalled()
  })

  it('fails when Daraja fails, so the caller can say no prompt was sent', async () => {
    mocks.stkPush.mockRejectedValue(new Error('Daraja down'))
    await expect(startCollection(input)).rejects.toThrow('Daraja down')
  })
})

describe('recording a started collection', () => {
  it('stores the Daraja IDs as a processing fare, polled by its CheckoutRequestID', () => {
    const started = { provider: 'daraja' as const, checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm-1' }
    expect(collectionFields(started)).toEqual({
      daraja_checkout_id: 'ws_CO_1',
      daraja_merchant_request_id: 'm-1',
      status: 'processing',
    })
    expect(transactionCodeOf(started)).toBe('ws_CO_1')
  })

  it('still knows how to record a Bitika fare, for when it is switched back on', () => {
    const started = { provider: 'bitika' as const, transactionCode: 'BTK1', status: 'processing' }
    expect(collectionFields(started)).toEqual({ bitika_transaction_code: 'BTK1', status: 'processing' })
    expect(transactionCodeOf(started)).toBe('BTK1')
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
