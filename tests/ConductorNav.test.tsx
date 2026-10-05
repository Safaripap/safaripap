import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ConductorNav } from '@/components/ConductorNav'

afterEach(cleanup)

describe('ConductorNav', () => {
  it('links both sections with real anchors carrying the vehicle', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" />)
    expect(screen.getByRole('link', { name: 'Fares' }).getAttribute('href')).toBe('/dashboard/KAB123B')
    expect(screen.getByRole('link', { name: 'Prompt passenger' }).getAttribute('href')).toBe(
      '/pay/KAB123B?from=conductor'
    )
  })

  it('never offers sacco-wide totals: conductors see only their own vehicle', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" />)
    expect(screen.queryByText('Sacco totals')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).not.toMatch(/sacco/)
  })

  it('marks only the active section as the current page', () => {
    render(<ConductorNav active="prompt" vehicleCode="KAB123B" />)
    expect(screen.getByRole('link', { name: 'Prompt passenger' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Fares' }).hasAttribute('aria-current')).toBe(false)
  })

  it('does not render dead links before the vehicle is known', () => {
    render(<ConductorNav active="fares" vehicleCode={null} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('Fares').closest('[aria-disabled="true"]')).not.toBeNull()
  })

  it('is a labelled navigation landmark', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" />)
    expect(screen.getByRole('navigation', { name: 'Conductor' })).toBeTruthy()
  })
})
