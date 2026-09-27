// Accepts 07XXXXXXXX, 01XXXXXXXX, 254XXXXXXXXX, or the same with spaces/dashes/+,
// and normalizes to the 254XXXXXXXXX format Bitika and Daraja expect.
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits
  return digits
}
