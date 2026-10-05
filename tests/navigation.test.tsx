import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => createElement('a', { href, ...rest }, children) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/supabase-browser', () => ({ supabaseBrowser: { auth: { signInWithPassword: vi.fn() } } }))

import { AppHeader } from '@/components/AppHeader'
import NotFound from '@/app/not-found'
import ConductorLogin from '@/app/login/page'
import SaccoLogin from '@/app/manage/login/page'

afterEach(cleanup)

describe('header navigation', () => {
  it('the logo always goes home', () => {
    render(<AppHeader />)
    expect(screen.getByRole('link', { name: 'Safaripap home' }).getAttribute('href')).toBe('/')
  })

  it('shows a labelled back button when a screen asks for one', () => {
    render(<AppHeader back={{ href: '/', label: 'Home' }} plate="KAB123B" alerts />)
    const back = screen.getByRole('link', { name: 'Home' })
    expect(back.getAttribute('href')).toBe('/')
    // Back comes first, so keyboard users reach it before the logo.
    const links = screen.getAllByRole('link')
    expect(links[0]).toBe(back)
  })

  it('has no back button unless asked', () => {
    render(<AppHeader />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})

describe('sign-in screens', () => {
  for (const [name, Page] of [['conductor', ConductorLogin], ['sacco', SaccoLogin]] as const) {
    it(`the ${name} sign-in has a way back to the sign-in choice and home`, () => {
      render(<Page />)
      expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/signin')
      expect(screen.getByRole('link', { name: 'Safaripap home' }).getAttribute('href')).toBe('/')
    })
  }
})

describe('page not found', () => {
  it('offers the ways forward instead of a dead end', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/pay', '/signin']))
  })
})
