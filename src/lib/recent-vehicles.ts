// The last few vehicles this phone paid (or started paying) on, so a regular
// commuter using the installed app can tap their usual matatu instead of
// typing its code. Kept in localStorage; every access is wrapped because
// private browsing and some WebViews throw.

const KEY = 'safaripap.recentVehicles'
const MAX = 3

export function getRecentVehicles(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((c) => typeof c === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberVehicle(code: string) {
  try {
    const next = [code, ...getRecentVehicles().filter((c) => c !== code)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Not remembered; the passenger can still type the code.
  }
}
