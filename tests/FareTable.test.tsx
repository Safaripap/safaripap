import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { FareTable } from '@/components/FareTable'
import type { Txn } from '@/lib/fares'

afterEach(cleanup)

const fare = (over: Partial<Txn>): Txn => ({
  id: 'f1',
  amount_kes: 50,
  phone_last3: '678',
  receipt_last3: 'F3K',
  status: 'fulfilled',
  verified_by_conductor: false,
  created_at: new Date().toISOString(),
  ...over,
})

function renderTable(rows: Txn[], onVerify = vi.fn()) {
  render(<FareTable rows={rows} query="" fullReceiptQuery="" fresh={{}} busy={false} onVerify={onVerify} />)
  return onVerify
}

describe('FareTable', () => {
  it('is a real table with column headers and one row per fare', () => {
    renderTable([fare({ id: 'a' }), fare({ id: 'b', phone_last3: '111' })])
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Phone / receipt',
      'KES',
      'Time',
      'Status',
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + 2 fares
  })

  it('reads the endings as phone and receipt endings', () => {
    renderTable([fare({})])
    const rowHeader = screen.getByRole('rowheader')
    expect(rowHeader.textContent).toContain('Phone ending 678')
    expect(rowHeader.textContent).toContain('receipt ending F3K')
  })

  it('offers Verify only for a paid fare not yet verified', () => {
    const onVerify = renderTable([
      fare({ id: 'paid' }),
      fare({ id: 'done', verified_by_conductor: true }),
      fare({ id: 'wait', status: 'processing', receipt_last3: '' }),
    ])
    const buttons = screen.getAllByRole('button', { name: /Verify/ })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(onVerify).toHaveBeenCalledWith('paid')
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('Waiting…')).toBeTruthy()
    expect(screen.getByLabelText('pending')).toBeTruthy()
  })

  it('shows the full receipt for a server receipt search', () => {
    renderTable([fare({ mpesa_receipt: 'TDK4H7XF3K' })])
    expect(screen.getByText(/Receipt/).textContent).toContain('TDK4H7XF3K')
  })
})
