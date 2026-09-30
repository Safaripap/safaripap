import { describe, expect, it } from 'vitest'
import { normalizePhoneNumber } from '@/lib/phone'

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
