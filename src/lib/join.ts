// Join requests from the public /join form: validation shared by the form and
// the API route, so both give the same messages.
import { isValidKenyanMobile, normalizePhoneNumber, toLocalKenyanNumber } from './phone'
import type { MemberRole } from './member-login'

export interface JoinInput {
  saccoName: string
  contactName: string
  phone: string
  role: MemberRole
  matatuCount: number
  plates: string
  notes?: string
}

export interface JoinRequest {
  sacco_name: string
  contact_name: string
  phone: string
  role: MemberRole
  matatu_count: number
  plates: string[]
  notes: string | null
}

export const JOIN_LIMITS = { text: 80, notes: 500, plates: 20, matatus: 500 }

// "kab 123b, KAC-456D\nKDD789E" → ['KAB123B', 'KAC456D', 'KDD789E']
export function parsePlates(raw: string): string[] {
  const plates = raw
    .split(/[\n,;]+/)
    .map((p) => p.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter((p) => p.length >= 4 && p.length <= 10)
  return [...new Set(plates)].slice(0, JOIN_LIMITS.plates)
}

export function validateJoin(input: JoinInput): string | null {
  if (!input.saccoName?.trim()) return 'Enter your sacco’s name.'
  if (!input.contactName?.trim()) return 'Enter your name.'
  if (input.saccoName.length > JOIN_LIMITS.text || input.contactName.length > JOIN_LIMITS.text) return 'That name is too long.'
  if (!isValidKenyanMobile(toLocalKenyanNumber(input.phone ?? ''))) return 'Enter a Kenyan mobile number, like 0712 345 678.'
  if (input.role !== 'manager' && input.role !== 'owner') return 'Tell us whether you manage the sacco or own matatus.'
  if (!Number.isInteger(input.matatuCount) || input.matatuCount < 1 || input.matatuCount > JOIN_LIMITS.matatus)
    return 'Enter how many matatus, between 1 and 500.'
  if ((input.notes ?? '').length > JOIN_LIMITS.notes) return `Keep the note under ${JOIN_LIMITS.notes} characters.`
  return null
}

export function toJoinRequest(input: JoinInput): JoinRequest {
  return {
    sacco_name: input.saccoName.trim(),
    contact_name: input.contactName.trim(),
    phone: normalizePhoneNumber(input.phone),
    role: input.role,
    matatu_count: input.matatuCount,
    plates: parsePlates(input.plates ?? ''),
    notes: input.notes?.trim() || null,
  }
}
