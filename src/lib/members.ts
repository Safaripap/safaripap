// Server-side management of sacco members (managers and owners): creating
// their login, linking owners to vehicles, resetting PINs, and resolving which
// vehicles a signed-in member may see. Only ever used with the service-role
// client. Imports are relative so scripts can use it too.

import type { SupabaseClient } from '@supabase/supabase-js'
import { PIN_LENGTH } from './conductor'
import { generatePin } from './onboarding'
import { memberEmail, type MemberRole } from './member-login'
import { isValidKenyanMobile, normalizePhoneNumber, toLocalKenyanNumber } from './phone'

export interface MemberInput {
  role: MemberRole
  fullName: string
  phone: string
  saccoId: string
  vehicleIds?: string[] // owners only
}

export interface Member {
  userId: string
  role: MemberRole
  fullName: string
  phone: string
  saccoId: string
  saccoName: string
  vehicles: { id: string; vehicle_code: string }[]
}

export function validateMemberInput(input: MemberInput): string | null {
  if (input.role !== 'manager' && input.role !== 'owner') return 'Choose manager or owner.'
  if (!input.fullName?.trim()) return 'Enter their full name.'
  if (!isValidKenyanMobile(toLocalKenyanNumber(input.phone ?? ''))) return 'Enter a Kenyan mobile number, like 0712 345 678.'
  if (!input.saccoId) return 'Choose a sacco.'
  if (input.role === 'owner' && !input.vehicleIds?.length) return 'Choose at least one vehicle this owner owns.'
  return null
}

// Creates the member's login and records. Undoes what it created if a later
// step fails, so a half-created member never exists. Returns the PIN, which is
// shown to the admin once and never stored in plain text.
export async function createMember(
  supabase: SupabaseClient,
  input: MemberInput
): Promise<{ userId: string; phone: string; pin: string }> {
  const invalid = validateMemberInput(input)
  if (invalid) throw new Error(invalid)
  const phone = normalizePhoneNumber(input.phone)
  const pin = generatePin()

  const { data: existing } = await supabase.from('sacco_members').select('user_id').eq('phone', phone).maybeSingle()
  if (existing) throw new Error('Someone with that phone number already has an account.')

  // Owners can only be linked to vehicles in their own sacco.
  let vehicleIds: string[] = []
  if (input.role === 'owner') {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id')
      .eq('sacco_id', input.saccoId)
      .in('id', input.vehicleIds!)
    vehicleIds = (vehicles ?? []).map((v) => v.id)
    if (vehicleIds.length !== input.vehicleIds!.length) throw new Error('Some of those vehicles are not in this sacco.')
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: memberEmail(phone),
    password: pin,
    email_confirm: true,
    user_metadata: { role: input.role, full_name: input.fullName.trim() },
  })
  if (authError || !created.user) {
    throw new Error(
      authError?.message?.includes('already been registered')
        ? 'Someone with that phone number already has an account.'
        : `Couldn't create the login: ${authError?.message}`
    )
  }
  const userId = created.user.id

  try {
    const { error } = await supabase.from('sacco_members').insert({
      user_id: userId,
      sacco_id: input.saccoId,
      role: input.role,
      full_name: input.fullName.trim(),
      phone,
    })
    if (error) throw new Error(`Couldn't save the member: ${error.message}`)

    if (vehicleIds.length) {
      const { error: linkError } = await supabase
        .from('vehicle_owners')
        .insert(vehicleIds.map((vehicle_id) => ({ vehicle_id, user_id: userId })))
      if (linkError) throw new Error(`Couldn't link their vehicles: ${linkError.message}`)
    }
  } catch (err) {
    // Deleting the auth user cascades to sacco_members and vehicle_owners.
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    throw err
  }

  return { userId, phone, pin }
}

export async function resetMemberPin(supabase: SupabaseClient, userId: string): Promise<string> {
  const pin = generatePin()
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: pin })
  if (error) throw new Error(`Couldn't reset the PIN: ${error.message}`)
  return pin
}

export async function removeMember(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Couldn't remove the member: ${error.message}`)
}

// Everything a signed-in member may see: their sacco and the vehicles in
// scope — all of the sacco's for a manager, only linked ones for an owner.
// Returns null if the user isn't a sacco member (e.g. a conductor).
export async function getMember(supabase: SupabaseClient, userId: string): Promise<Member | null> {
  const { data: m } = await supabase
    .from('sacco_members')
    .select('user_id, role, full_name, phone, sacco_id, saccos(name)')
    .eq('user_id', userId)
    .maybeSingle()
  if (!m) return null

  let vehicles: { id: string; vehicle_code: string }[] = []
  if (m.role === 'manager') {
    const { data } = await supabase.from('vehicles').select('id, vehicle_code').eq('sacco_id', m.sacco_id).order('vehicle_code')
    vehicles = data ?? []
  } else {
    const { data } = await supabase
      .from('vehicle_owners')
      .select('vehicles(id, vehicle_code, sacco_id)')
      .eq('user_id', userId)
    vehicles = (data ?? [])
      .map((r: any) => r.vehicles)
      .filter((v: any) => v && v.sacco_id === m.sacco_id)
      .map((v: any) => ({ id: v.id, vehicle_code: v.vehicle_code }))
      .sort((a, b) => a.vehicle_code.localeCompare(b.vehicle_code))
  }

  return {
    userId: m.user_id,
    role: m.role as MemberRole,
    fullName: m.full_name,
    phone: m.phone,
    saccoId: m.sacco_id,
    saccoName: (m as any).saccos?.name ?? '',
    vehicles,
  }
}

export { PIN_LENGTH }
