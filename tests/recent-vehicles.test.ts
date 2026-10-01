import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRecentVehicles, rememberVehicle } from '@/lib/recent-vehicles'

afterEach(() => localStorage.clear())

describe('recent vehicles', () => {
  it('starts empty', () => {
    expect(getRecentVehicles()).toEqual([])
  })

  it('keeps the most recent first, without duplicates, capped at 3', () => {
    rememberVehicle('KAB123B')
    rememberVehicle('KCD456C')
    rememberVehicle('KAB123B')
    expect(getRecentVehicles()).toEqual(['KAB123B', 'KCD456C'])
    rememberVehicle('KEF789D')
    rememberVehicle('KGH012E')
    expect(getRecentVehicles()).toEqual(['KGH012E', 'KEF789D', 'KAB123B'])
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem('safaripap.recentVehicles', '{not json')
    expect(getRecentVehicles()).toEqual([])
    localStorage.setItem('safaripap.recentVehicles', JSON.stringify(['KAB123B', 42, null]))
    expect(getRecentVehicles()).toEqual(['KAB123B'])
  })

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => rememberVehicle('KAB123B')).not.toThrow()
    expect(getRecentVehicles()).toEqual([])
  })
})
