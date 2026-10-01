import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ConductorNav } from '@/components/ConductorNav'

afterEach(cleanup)

describe('ConductorNav', () => {
  it('links every section with real anchors carrying the vehicle and sacco', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" saccoId="s-1" />)
    expect(screen.getByRole('link', { name: 'Fares' }).getAttribute('href')).toBe('/dashboard/KAB123B')
    expect(screen.getByRole('link', { name: 'Prompt passenger' }).getAttribute('href')).toBe(
      '/pay/KAB123B?from=conductor&sacco=s-1'
    )
    expect(screen.getByRole('link', { name: 'Sacco totals' }).getAttribute('href')).toBe('/sacco/s-1?vehicle=KAB123B')
  })

  it('marks only the active section as the current page', () => {
    render(<ConductorNav active="sacco" vehicleCode="KAB123B" saccoId="s-1" />)
    expect(screen.getByRole('link', { name: 'Sacco totals' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Fares' }).hasAttribute('aria-current')).toBe(false)
  })

  it('does not render a dead link when the vehicle has no sacco', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" saccoId={null} />)
    expect(screen.queryByRole('link', { name: 'Sacco totals' })).toBeNull()
    expect(screen.getByText('Sacco totals').closest('[aria-disabled="true"]')).not.toBeNull()
  })

  it('is a labelled navigation landmark', () => {
    render(<ConductorNav active="fares" vehicleCode="KAB123B" />)
    expect(screen.getByRole('navigation', { name: 'Conductor' })).toBeTruthy()
  })
})
