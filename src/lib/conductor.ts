// Conductors log in with their vehicle code + a PIN, not an email. Supabase Auth
// still needs an email, so each vehicle gets an internal one that never
// receives mail (accounts are created confirmed by scripts/create-conductor.ts).
export function conductorEmail(vehicleCode: string): string {
  return `${vehicleCode.trim().toLowerCase()}@conductors.safaripap.local`
}

// Supabase's minimum password length is 6.
export const PIN_LENGTH = 6
