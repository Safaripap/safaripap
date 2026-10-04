import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyHighContrast, DISPLAY_BOOT_SCRIPT, getPreference, setPreference } from '@/lib/preferences'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.contrast
  delete document.documentElement.dataset.text
})

describe('preferences', () => {
  it('defaults sound and vibration on, high contrast off', () => {
    expect(getPreference('sound')).toBe(true)
    expect(getPreference('vibrate')).toBe(true)
    expect(getPreference('highContrast')).toBe(false)
  })

  it('persists changes in localStorage', () => {
    setPreference('sound', false)
    expect(localStorage.getItem('safaripap.sound')).toBe('off')
    expect(getPreference('sound')).toBe(false)
    setPreference('sound', true)
    expect(getPreference('sound')).toBe(true)
  })

  it('falls back to defaults when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getPreference('vibrate')).toBe(true)
    expect(getPreference('highContrast')).toBe(false)
  })

  it('still applies high contrast when saving throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setPreference('highContrast', true)
    expect(document.documentElement.dataset.contrast).toBe('high')
  })

  it('defaults reading aloud on and larger text off', () => {
    expect(getPreference('readAloud')).toBe(true)
    expect(getPreference('largeText')).toBe(false)
  })

  it('applies saved display settings before first paint', () => {
    localStorage.setItem('safaripap.largeText', 'on')
    localStorage.setItem('safaripap.highContrast', 'on')
    new Function(DISPLAY_BOOT_SCRIPT)()
    expect(document.documentElement.dataset.text).toBe('large')
    expect(document.documentElement.dataset.contrast).toBe('high')
  })

  it('toggles the data-contrast attribute on <html>', () => {
    applyHighContrast(true)
    expect(document.documentElement.dataset.contrast).toBe('high')
    applyHighContrast(false)
    expect(document.documentElement.dataset.contrast).toBeUndefined()
  })
})
