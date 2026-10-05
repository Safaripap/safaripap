import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const state = vi.hoisted(() => ({
  session: null as any,
  signOut: vi.fn(async () => ({ error: null })),
  replace: vi.fn(),
  from: vi.fn(),
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => createElement('a', { href, ...rest }, children) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace, push: vi.fn() }) }))
vi.mock('@/lib/supabase-browser', () => ({
  supabaseBrowser: {
    auth: { getSession: async () => ({ data: { session: state.session } }), signOut: state.signOut, signInWithPassword: vi.fn() },
    from: state.from,
    getChannels: () => [],
    removeChannel: vi.fn(),
  },
}))

import { SignOutButton } from '@/components/SignOutButton'
import Dashboard from '@/app/dashboard/[vehicleCode]/page'
import ConductorLogin from '@/app/login/page'

beforeEach(() => {
  state.session = null
  state.signOut.mockClear()
  state.replace.mockClear()
  state.from.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('SignOutButton', () => {
  it('asks for a second tap, so a stray tap never signs the conductor out', async () => {
    const done = vi.fn()
    render(<SignOutButton onSignedOut={done} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(state.signOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to sign out' }))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(state.signOut).toHaveBeenCalledOnce()
  })

  it('forgets the first tap after a few seconds', () => {
    vi.useFakeTimers()
    render(<SignOutButton onSignedOut={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(state.signOut).not.toHaveBeenCalled()
  })
})

describe('conductor dashboard when signed out', () => {
  it('goes to sign in with the vehicle filled in, instead of saying the vehicle does not exist', async () => {
    render(<Dashboard params={{ vehicleCode: 'kab123b' }} />)
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/login?vehicle=KAB123B'))
    expect(state.from).not.toHaveBeenCalled()
    expect(screen.queryByText(/No vehicle registered/)).toBeNull()
  })
})

describe('conductor sign in', () => {
  it('fills in the vehicle code passed from the dashboard', async () => {
    window.history.replaceState(null, '', '/login?vehicle=kab123b')
    render(<ConductorLogin />)
    await waitFor(() => expect((screen.getByLabelText('Vehicle code') as HTMLInputElement).value).toBe('KAB123B'))
  })
})
