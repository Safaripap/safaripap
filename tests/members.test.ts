import { describe, expect, it, vi } from 'vitest'

// members.ts imports onboarding.ts for generatePin, which pulls in the LNbits
// client; stub it so no env or network is needed.
vi.mock('@/lib/lnbits', () => ({}))

import { memberEmail } from '@/lib/member-login'
import { createMember, getMember, validateMemberInput, type MemberInput } from '@/lib/members'

// A small query-builder fake: filters with eq/in, supports insert, and records
// auth users so we can check rollback.
function fakeSupabase(seed: Record<string, any[]>, opts: { failOwnerLinks?: boolean } = {}) {
  const tables: Record<string, any[]> = { sacco_members: [], vehicle_owners: [], ...structuredClone(seed) }
  const users = new Set<string>()
  const from = (table: string) => {
    const filters: ((r: any) => boolean)[] = []
    let inserted: any[] | null = null
    const rows = () => tables[table].filter((r) => filters.every((f) => f(r)))
    const b: any = {
      select: () => b,
      order: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      insert: (row: any) => {
        inserted = Array.isArray(row) ? row : [row]
        return b
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: any) => {
        if (inserted) {
          if (table === 'vehicle_owners' && opts.failOwnerLinks) return resolve({ error: { message: 'db down' } })
          tables[table].push(...inserted)
          return resolve({ error: null })
        }
        return resolve({ data: rows(), error: null })
      },
    }
    return b
  }
  const supabase: any = {
    from,
    auth: {
      admin: {
        createUser: async () => {
          const id = `u-${users.size + 1}`
          users.add(id)
          return { data: { user: { id } }, error: null }
        },
        deleteUser: async (id: string) => {
          users.delete(id)
          // Mimic ON DELETE CASCADE.
          tables.sacco_members = tables.sacco_members.filter((m) => m.user_id !== id)
          tables.vehicle_owners = tables.vehicle_owners.filter((o) => o.user_id !== id)
          return { error: null }
        },
      },
    },
  }
  return { supabase, tables, users }
}

const seed = {
  saccos: [{ id: 's-1', name: 'Test SACCO' }],
  vehicles: [
    { id: 'v-1', vehicle_code: 'KAB123B', sacco_id: 's-1' },
    { id: 'v-2', vehicle_code: 'KAC456D', sacco_id: 's-1' },
    { id: 'v-9', vehicle_code: 'KZZ999Z', sacco_id: 's-2' },
  ],
}

const owner = (over: Partial<MemberInput> = {}): MemberInput => ({
  role: 'owner',
  fullName: 'Wanjiru Kamau',
  phone: '0712 345 678',
  saccoId: 's-1',
  vehicleIds: ['v-1'],
  ...over,
})

describe('memberEmail', () => {
  it('maps every Kenyan format to the same internal email', () => {
    const e = '254712345678@members.safaripap.local'
    expect(memberEmail('0712345678')).toBe(e)
    expect(memberEmail('712 345 678')).toBe(e)
    expect(memberEmail('+254 712 345 678')).toBe(e)
  })
})

describe('validateMemberInput', () => {
  it('accepts a valid owner and manager', () => {
    expect(validateMemberInput(owner())).toBeNull()
    expect(validateMemberInput(owner({ role: 'manager', vehicleIds: [] }))).toBeNull()
  })

  it('rejects bad input with a readable message', () => {
    expect(validateMemberInput(owner({ fullName: ' ' }))).toMatch(/name/)
    expect(validateMemberInput(owner({ phone: '0812345678' }))).toMatch(/Kenyan mobile/)
    expect(validateMemberInput(owner({ vehicleIds: [] }))).toMatch(/at least one vehicle/)
    expect(validateMemberInput(owner({ role: 'admin' as any }))).toMatch(/manager or owner/)
  })
})

describe('createMember', () => {
  it('creates the login, membership and vehicle links, and returns a PIN', async () => {
    const { supabase, tables, users } = fakeSupabase(seed)
    const res = await createMember(supabase, owner({ vehicleIds: ['v-1', 'v-2'] }))
    expect(res.phone).toBe('254712345678')
    expect(res.pin).toMatch(/^\d{6}$/)
    expect(users.has(res.userId)).toBe(true)
    expect(tables.sacco_members).toEqual([
      expect.objectContaining({ user_id: res.userId, role: 'owner', phone: '254712345678', sacco_id: 's-1' }),
    ])
    expect(tables.vehicle_owners.map((o) => o.vehicle_id).sort()).toEqual(['v-1', 'v-2'])
  })

  it("refuses to link an owner to another sacco's vehicle, before creating anything", async () => {
    const { supabase, users } = fakeSupabase(seed)
    await expect(createMember(supabase, owner({ vehicleIds: ['v-1', 'v-9'] }))).rejects.toThrow(/not in this sacco/)
    expect(users.size).toBe(0)
  })

  it('refuses a phone number that already has an account', async () => {
    const { supabase } = fakeSupabase({
      ...seed,
      sacco_members: [{ user_id: 'u-0', phone: '254712345678' }],
    })
    await expect(createMember(supabase, owner())).rejects.toThrow(/already has an account/)
  })

  it('removes the login again if linking vehicles fails', async () => {
    const { supabase, tables, users } = fakeSupabase(seed, { failOwnerLinks: true })
    await expect(createMember(supabase, owner())).rejects.toThrow(/link their vehicles/)
    expect(users.size).toBe(0)
    expect(tables.sacco_members).toEqual([])
  })
})

describe('getMember', () => {
  it('gives a manager every vehicle in their sacco', async () => {
    const { supabase } = fakeSupabase({
      ...seed,
      sacco_members: [
        { user_id: 'm-1', role: 'manager', full_name: 'Otieno', phone: '254700000001', sacco_id: 's-1', saccos: { name: 'Test SACCO' } },
      ],
    })
    const m = await getMember(supabase, 'm-1')
    expect(m?.saccoName).toBe('Test SACCO')
    expect(m?.vehicles.map((v) => v.vehicle_code)).toEqual(['KAB123B', 'KAC456D'])
  })

  it('gives an owner only their linked vehicles in their sacco', async () => {
    const { supabase } = fakeSupabase({
      ...seed,
      sacco_members: [{ user_id: 'o-1', role: 'owner', full_name: 'Achieng', phone: '254700000002', sacco_id: 's-1' }],
      vehicle_owners: [
        { user_id: 'o-1', vehicles: { id: 'v-2', vehicle_code: 'KAC456D', sacco_id: 's-1' } },
        // A stale link to another sacco's vehicle must not leak through.
        { user_id: 'o-1', vehicles: { id: 'v-9', vehicle_code: 'KZZ999Z', sacco_id: 's-2' } },
      ],
    })
    const m = await getMember(supabase, 'o-1')
    expect(m?.vehicles).toEqual([{ id: 'v-2', vehicle_code: 'KAC456D', is_demo: false }])
  })

  it('returns null for someone who is not a sacco member', async () => {
    const { supabase } = fakeSupabase(seed)
    expect(await getMember(supabase, 'conductor-1')).toBeNull()
  })
})
