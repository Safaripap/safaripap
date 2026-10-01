import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Highlight } from '@/components/Highlight'

afterEach(cleanup)

describe('Highlight', () => {
  it('marks the matching part, case-insensitively', () => {
    const { container } = render(<Highlight text="9f3" query="F3" />)
    expect(container.querySelector('mark')?.textContent).toBe('f3')
    expect(container.textContent).toBe('9f3')
  })

  it('marks the last occurrence in suffix mode', () => {
    const { container } = render(<Highlight text="AB12AB12" query="AB12" suffix />)
    const mark = container.querySelector('mark')!
    expect(mark.textContent).toBe('AB12')
    expect(mark.previousSibling?.textContent).toBe('AB12')
  })

  it('renders plain text with no match or no query', () => {
    expect(render(<Highlight text="482" query="7" />).container.querySelector('mark')).toBeNull()
    expect(render(<Highlight text="482" query="" />).container.querySelector('mark')).toBeNull()
  })
})
