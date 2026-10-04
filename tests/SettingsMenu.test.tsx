import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsMenu } from '@/components/SettingsMenu'

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.contrast
  delete document.documentElement.dataset.text
})

describe('SettingsMenu', () => {
  it('has an accessible name and opens a panel of switches', () => {
    render(<SettingsMenu alerts />)
    const button = screen.getByRole('button', { name: 'Settings' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('switch')).toHaveLength(4)
  })

  it('shows only the display switches when alerts are not relevant', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'Larger text' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'High contrast' })).toBeTruthy()
  })

  it('applies larger text immediately and remembers it', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Larger text' }))
    expect(document.documentElement.dataset.text).toBe('large')
    expect(localStorage.getItem('safaripap.largeText')).toBe('on')
  })

  it('defaults sound and vibration on and persists a change', () => {
    render(<SettingsMenu alerts />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const sound = screen.getByRole('switch', { name: 'Sound on new payment' }) as HTMLInputElement
    expect(sound.checked).toBe(true)
    fireEvent.click(sound)
    expect(sound.checked).toBe(false)
    expect(localStorage.getItem('safaripap.sound')).toBe('off')
  })

  it('applies high contrast immediately', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('switch', { name: 'High contrast' }))
    expect(document.documentElement.dataset.contrast).toBe('high')
  })

  it('closes on Escape and returns focus to the button', () => {
    render(<SettingsMenu />)
    const button = screen.getByRole('button', { name: 'Settings' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.activeElement).toBe(button)
  })
})
