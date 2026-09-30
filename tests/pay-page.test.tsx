import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, forwardRef } from 'react'

// Render framer-motion components as plain elements so screens swap
// instantly in jsdom.
vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, transition, ...rest }: any) => rest
  // Cache one component per tag: a new component type on every render would
  // remount the screen.
  const cache: Record<string, any> = {}
  const motion = new Proxy(
    {},
    {
      get: (_, tag: string) =>
        (cache[tag] ??= forwardRef((props: any, ref) => createElement(tag, { ...strip(props), ref }))),
    }
  )
  return { motion, AnimatePresence: ({ children }: any) => children }
})
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => createElement('a', { href, ...rest }, children) }))

import PayPage from '@/app/pay/[vehicleCode]/page'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ vehicle_code: 'KAB123B', preset_fare_kes: 50 }) }))
  )
})
afterEach(cleanup)

async function openPhoneScreen() {
  render(<PayPage params={{ vehicleCode: 'kab123b' }} searchParams={{}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  return screen.findByLabelText(/M-Pesa phone number/)
}

describe('pay screen phone entry', () => {
  it('moves focus to the new screen heading once', async () => {
    await openPhoneScreen()
    expect(document.activeElement?.textContent).toBe('Your M-Pesa number')
  })

  it('keeps focus in the phone field while typing (regression: focus jumped to the heading on every keystroke)', async () => {
    const input = (await openPhoneScreen()) as HTMLInputElement
    input.focus()
    let typed = ''
    for (const ch of '0712345678') {
      typed += ch
      fireEvent.change(input, { target: { value: typed } })
      expect(document.activeElement).toBe(input)
    }
  })

  it('shows +254 and formats what the passenger types', async () => {
    const input = (await openPhoneScreen()) as HTMLInputElement
    expect(screen.getByText('+254')).toBeTruthy()
    fireEvent.change(input, { target: { value: '0712345678' } })
    expect(input.value).toBe('712 345 678')
  })

  it('only enables Pay for a valid Kenyan mobile number', async () => {
    const input = await openPhoneScreen()
    const pay = screen.getByRole('button', { name: /Pay KES 50/ }) as HTMLButtonElement
    expect(pay.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '0512345678' } })
    expect(pay.disabled).toBe(true)
    expect(screen.getByText(/should start with 7 or 1/)).toBeTruthy()
    fireEvent.change(input, { target: { value: '0712345678' } })
    expect(pay.disabled).toBe(false)
  })

  it('sends the number in 254 format', async () => {
    const input = await openPhoneScreen()
    fireEvent.change(input, { target: { value: '0712 345 678' } })
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'stop here' }) } as any)
    fireEvent.click(screen.getByRole('button', { name: /Pay KES 50/ }))
    await screen.findByText('stop here')
    const [, init] = fetchMock.mock.calls.at(-1)!
    expect(JSON.parse((init as RequestInit).body as string).phone).toBe('254712345678')
  })
})
