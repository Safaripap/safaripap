import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ vehicle: null as any, collect: vi.fn() }))

vi.mock('@/lib/bitika', () => ({ collectPayment: state.collect }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        single: async () => ({ data: state.vehicle, error: state.vehicle ? null : { message: 'none' } }),
        insert: async () => ({ error: null }),
      }
      return b
    },
  },
}))

import { POST as pay } from '@/app/api/pay/route'
import { GET as getVehicle } from '@/app/api/vehicles/[code]/route'

const demo = {
  id: 'v', vehicle_code: 'KDG214A', preset_fare_kes: 60, is_demo: true,
  lightning_address: 'kdg214a@demo.invalid', lnbits_invoice_key: 'secret',
}

beforeEach(() => {
  state.vehicle = demo
  state.collect.mockReset()
})

describe('demo matatus can never be paid', () => {
  it('the pay API refuses them without calling Bitika', async () => {
    const res = await pay(
      new NextRequest('http://localhost/api/pay', {
        method: 'POST',
        body: JSON.stringify({ vehicleCode: 'KDG214A', amountKes: 60, phone: '0712345678' }),
      })
    )
    expect(res.status).toBe(404)
    expect(state.collect).not.toHaveBeenCalled()
  })

  it('the vehicle lookup treats them as unknown', async () => {
    const res = await getVehicle(new NextRequest('http://localhost'), { params: { code: 'kdg214a' } })
    expect(res.status).toBe(404)
  })

  it('the vehicle lookup returns only what the pay screen needs for real matatus', async () => {
    state.vehicle = { ...demo, is_demo: false }
    const res = await getVehicle(new NextRequest('http://localhost'), { params: { code: 'kdg214a' } })
    expect(await res.json()).toEqual({ vehicle_code: 'KDG214A', preset_fare_kes: 60 })
  })
})
