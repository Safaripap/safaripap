import { describe, expect, it } from 'vitest'
import { isForSacco } from '@/lib/receipts'

describe('isForSacco', () => {
  const tags = [['t', 'matatu-payment'], ['vehicle', 'KAB123B'], ['sacco', 's1'], ['demo', 'true']]
  it('keeps receipts for this sacco, demo ones included', () => expect(isForSacco(tags, 's1')).toBe(true))
  it('drops receipts for other saccos', () => expect(isForSacco(tags, 's2')).toBe(false))
  it('drops receipts with no sacco tag', () => expect(isForSacco([['t', 'matatu-payment']], 's1')).toBe(false))
})
