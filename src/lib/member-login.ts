// Sacco managers and matatu owners sign in with their phone number + PIN.
// Supabase Auth still needs an email, so each member gets an internal one
// built from their number that never receives mail. Safe to import in the
// browser (used by /manage/login).
import { normalizePhoneNumber } from './phone'

export type MemberRole = 'manager' | 'owner'

export const ROLE_LABEL: Record<MemberRole, string> = {
  manager: 'Sacco manager',
  owner: 'Matatu owner',
}

// Any Kenyan format in ("0712…", "712…", "+254 712…") → the internal email.
export function memberEmail(phone: string): string {
  return `${normalizePhoneNumber(phone)}@members.safaripap.local`
}
