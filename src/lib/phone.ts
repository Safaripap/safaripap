// Accepts 07XXXXXXXX, 01XXXXXXXX, 254XXXXXXXXX, or the same with spaces/dashes/+,
// and normalizes to the 254XXXXXXXXX format Bitika and Daraja expect.
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits
  return digits
}

// The pay screen shows a fixed +254 box and lets passengers type the rest the
// way they're used to: "0712 345 678", "712345678", or even a pasted
// "+254 712 345 678". This reduces any of those to the 9-digit national number.
export function toLocalKenyanNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254')) digits = digits.slice(3)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 9)
}

// Safaricom/Airtel mobile numbers: 7XX XXX XXX or 1XX XXX XXX.
export function isValidKenyanMobile(local: string): boolean {
  return /^[71]\d{8}$/.test(local)
}

// "712345678" → "712 345 678", for display while typing.
export function formatLocalKenyanNumber(local: string): string {
  return [local.slice(0, 3), local.slice(3, 6), local.slice(6, 9)].filter(Boolean).join(' ')
}
