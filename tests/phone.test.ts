import { describe, expect, it } from 'vitest'
import { formatLocalKenyanNumber, isValidKenyanMobile, normalizePhoneNumber, toLocalKenyanNumber } from '@/lib/phone'

describe('normalizePhoneNumber', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['254712345678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
    ['0712-345-678', '254712345678'],
    ['712345678', '254712345678'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhoneNumber(raw)).toBe(expected)
  })

  it('returns bare digits for input it does not recognise', () => {
    expect(normalizePhoneNumber('12345')).toBe('12345')
  })
})

describe('toLocalKenyanNumber', () => {
  it.each([
    ['0712 345 678', '712345678'],
    ['712345678', '712345678'],
    ['+254 712 345 678', '712345678'],
    ['254112345678', '112345678'],
    ['07', '7'],
    ['0712345678999', '712345678'],
  ])('%s → %s', (raw, expected) => {
    expect(toLocalKenyanNumber(raw)).toBe(expected)
  })
})

describe('isValidKenyanMobile', () => {
  it('accepts 9-digit numbers starting with 7 or 1', () => {
    expect(isValidKenyanMobile('712345678')).toBe(true)
    expect(isValidKenyanMobile('112345678')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isValidKenyanMobile('512345678')).toBe(false)
    expect(isValidKenyanMobile('71234567')).toBe(false)
  })
})

describe('formatLocalKenyanNumber', () => {
  it('groups digits as 3-3-3 while typing', () => {
    expect(formatLocalKenyanNumber('7')).toBe('7')
    expect(formatLocalKenyanNumber('7123')).toBe('712 3')
    expect(formatLocalKenyanNumber('712345678')).toBe('712 345 678')
  })
})
