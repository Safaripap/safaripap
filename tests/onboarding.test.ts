import { beforeEach, describe, expect, it, vi } from 'vitest'

const lnbits = vi.hoisted(() => ({
  createWallet: vi.fn(),
  createLnurlpLink: vi.fn(),
  deleteLnurlpLink: vi.fn(),
  lightningAddressFor: (u: string) => `${u}@mildjerky8.lnbits.com`,
}))
vi.mock('@/lib/lnbits', () => lnbits)

import { generatePin, normalizeVehicleCode, onboardVehicle, validateOnboardInput, type StepEvent } from '@/lib/onboarding'

// In-memory stand-in for the parts of the Supabase client onboarding uses.
function fakeSupabase(opts: { failConductor?: boolean } = {}) {
  const tables: Record<string, any[]> = {
    saccos: [{ id: 's-1', name: 'Test SACCO' }],
    vehicles: [{ id: 'v-0', vehicle_code: 'KAB123B' }],
  }
  const users: string[] = []
  let n = 0
  const from = (table: string) => {
    let filter: [string, unknown] | null = null
    let pending: any = null
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
    const rows = () => tables[table].filter((r) => !filter || r[filter[0]] === filter[1])
    const b: any = {
      select: () => b,
      insert: (row: any) => ((mode = 'insert'), (pending = { id: `${table}-${++n}`, ...row }), b),
      update: (patch: any) => ((mode = 'update'), (pending = patch), b),
      delete: () => ((mode = 'delete'), b),
      eq: (col: string, val: unknown) => {
        filter = [col, val]
        if (mode === 'delete') tables[table] = tables[table].filter((r) => r[col] !== val)
        if (mode === 'update') rows().forEach((r) => Object.assign(r, pending))
        return b
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => {
        if (mode === 'insert') {
          tables[table].push(pending)
          return { data: pending, error: null }
        }
        const r = rows()[0]
        return { data: r ?? null, error: r ? null : { message: 'not found' } }
      },
      then: (resolve: any) => resolve({ error: null }),
    }
    return b
  }
  const supabase: any = {
    from,
    auth: {
      admin: {
        createUser: async () =>
          opts.failConductor
            ? { data: null, error: new Error('auth is down') }
            : (users.push('u-1'), { data: { user: { id: 'u-1' } }, error: null }),
        deleteUser: async (id: string) => users.splice(users.indexOf(id), 1),
        updateUserById: async () => ({ error: null }),
      },
    },
  }
  return { supabase, tables, users }
}

const input = { vehicleCode: 'kab 456c', conductorName: 'Wanjiru', saccoId: 's-1', presetFareKes: 50, pin: '482913' }

beforeEach(() => {
  lnbits.createWallet.mockResolvedValue({ id: 'w-1', name: 'KAB456C fares', adminkey: 'ak', inkey: 'ik' })
  lnbits.createLnurlpLink.mockResolvedValue({ id: 'link-1', username: 'kab456c' })
  lnbits.deleteLnurlpLink.mockReset()
})

describe('onboardVehicle', () => {
  it('runs every step in order and returns what the admin screen shows', async () => {
    const { supabase, tables } = fakeSupabase()
    const events: StepEvent[] = []
    const result = await onboardVehicle(supabase, input, (e) => events.push(e))

    expect(result).toMatchObject({
      vehicleCode: 'KAB456C',
      saccoName: 'Test SACCO',
      lightningAddress: 'kab456c@mildjerky8.lnbits.com',
      pin: '482913',
    })
    const done = events.filter((e) => e.type === 'step' && e.status === 'done').map((e: any) => e.step)
    expect(done).toEqual(['sacco', 'wallet', 'address', 'vehicle', 'conductor'])

    const vehicle = tables.vehicles.find((v) => v.vehicle_code === 'KAB456C')
    expect(vehicle).toMatchObject({
      sacco_id: 's-1',
      preset_fare_kes: 50,
      lnbits_wallet_id: 'w-1',
      lnbits_invoice_key: 'ik',
      lightning_address: 'kab456c@mildjerky8.lnbits.com',
      conductor_user_id: 'u-1',
    })
    // The admin key never lands in our database.
    expect(JSON.stringify(vehicle)).not.toContain('"ak"')
  })

  it('asks LNbits for a Lightning Address named after the plate', async () => {
    const { supabase } = fakeSupabase()
    await onboardVehicle(supabase, input)
    expect(lnbits.createLnurlpLink).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ username: 'kab456c' }))
  })

  it('creates a new sacco when asked', async () => {
    const { supabase, tables } = fakeSupabase()
    const result = await onboardVehicle(supabase, { ...input, saccoId: null, newSaccoName: '  Super Metro ' })
    expect(result.saccoName).toBe('Super Metro')
    expect(tables.saccos.map((s) => s.name)).toContain('Super Metro')
  })

  it('refuses a plate that is already onboarded, before creating anything', async () => {
    const { supabase } = fakeSupabase()
    await expect(onboardVehicle(supabase, { ...input, vehicleCode: 'KAB 123B' })).rejects.toThrow('already onboarded')
    expect(lnbits.createWallet).not.toHaveBeenCalled()
  })

  it('undoes everything if a later step fails', async () => {
    const { supabase, tables } = fakeSupabase({ failConductor: true })
    const events: StepEvent[] = []
    await expect(
      onboardVehicle(supabase, { ...input, saccoId: null, newSaccoName: 'Rollback Sacco' }, (e) => events.push(e))
    ).rejects.toThrow('auth is down')

    expect(events.at(-1)).toEqual({ type: 'failed', step: 'conductor', error: 'auth is down' })
    expect(tables.vehicles.map((v) => v.vehicle_code)).toEqual(['KAB123B'])
    expect(tables.saccos.map((s) => s.name)).toEqual(['Test SACCO'])
    expect(lnbits.deleteLnurlpLink).toHaveBeenCalledWith(expect.objectContaining({ id: 'w-1' }), 'link-1')
  })

  it('reports which step failed when LNbits is unreachable', async () => {
    lnbits.createWallet.mockRejectedValueOnce(new Error('LNbits POST /api/v1/wallet failed (502)'))
    const { supabase } = fakeSupabase()
    const events: StepEvent[] = []
    await expect(onboardVehicle(supabase, input, (e) => events.push(e))).rejects.toThrow()
    expect(events.at(-1)).toMatchObject({ type: 'failed', step: 'wallet' })
  })
})

describe('validation and helpers', () => {
  it('normalizes plates', () => {
    expect(normalizeVehicleCode(' kab 123-b ')).toBe('KAB123B')
  })

  it('explains what is wrong with the form', () => {
    expect(validateOnboardInput({ ...input, vehicleCode: 'K1' })).toMatch(/plate/)
    expect(validateOnboardInput({ ...input, conductorName: ' ' })).toMatch(/conductor/)
    expect(validateOnboardInput({ ...input, presetFareKes: 5 })).toMatch(/between 10 and 10,000/)
    expect(validateOnboardInput({ ...input, saccoId: null, newSaccoName: '' })).toMatch(/sacco/)
    expect(validateOnboardInput({ ...input, pin: '12' })).toMatch(/6 digits/)
    expect(validateOnboardInput(input)).toBeNull()
  })

  it('generates 6-digit PINs', () => {
    for (let i = 0; i < 50; i++) expect(generatePin()).toMatch(/^\d{6}$/)
  })
})
