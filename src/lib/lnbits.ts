// LNbits helpers for vehicle onboarding, against our LNbits SaaS instance
// (LNBITS_HOST, e.g. https://mildjerky8.lnbits.com).
//
// Every vehicle wallet lives under the one super-user account whose wallet
// admin key is LNBITS_ADMIN_KEY — so all vehicle wallets are visible from that
// login, which is also what we show live on demo day.

function host() {
  const h = process.env.LNBITS_HOST
  if (!h) throw new Error('LNBITS_HOST is not set')
  return h.replace(/\/$/, '')
}

function adminKey() {
  const k = process.env.LNBITS_ADMIN_KEY
  if (!k) throw new Error('LNBITS_ADMIN_KEY is not set')
  return k
}

export interface LnbitsWallet {
  id: string
  name: string
  adminkey: string
  inkey: string
}

async function lnbits(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(`${host()}${path}`, {
    ...init,
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', ...init.headers },
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      detail = JSON.parse(text).detail ?? text
    } catch {}
    throw new Error(`LNbits ${init.method ?? 'GET'} ${path} failed (${res.status}): ${detail}`)
  }
  return text ? JSON.parse(text) : null
}

// Creating a wallet is an account-level action: since LNbits 1.x a wallet's
// admin key is refused (401 "Missing user ID or access token"). It needs
// either an access token for the account (LNBITS_ACCESS_TOKEN, preferred) or
// the account's user ID (LNBITS_USER_ID) — the ID of the *account*, not of a
// wallet. The new wallet belongs to that account, alongside LNBITS_ADMIN_KEY's.
export async function createWallet(name: string): Promise<LnbitsWallet> {
  const token = process.env.LNBITS_ACCESS_TOKEN
  const userId = process.env.LNBITS_USER_ID
  if (!token && !userId) {
    throw new Error(
      "LNbits can't create wallets yet: set LNBITS_ACCESS_TOKEN (or LNBITS_USER_ID, your LNbits account's user ID — not a wallet ID)."
    )
  }
  const path = token ? '/api/v1/wallet' : `/api/v1/wallet?usr=${encodeURIComponent(userId!)}`
  const res = await fetch(`${host()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ name }),
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      detail = JSON.parse(text).detail ?? text
    } catch {}
    throw new Error(`LNbits POST /api/v1/wallet failed (${res.status}): ${detail}`)
  }
  return JSON.parse(text)
}

// A static Lightning Address (username@instance) paying into `wallet`, via the
// LNURLp extension — which must be enabled on the instance. Bitika pays this
// address when a fare's M-Pesa payment succeeds.
export async function createLnurlpLink(
  wallet: LnbitsWallet,
  opts: { description: string; username: string }
): Promise<{ id: string; username: string }> {
  return lnbits('/lnurlp/api/v1/links', wallet.adminkey, {
    method: 'POST',
    body: JSON.stringify({
      description: opts.description,
      username: opts.username,
      min: 1,
      max: 1_000_000,
      comment_chars: 0,
    }),
  })
}

export async function deleteLnurlpLink(wallet: LnbitsWallet, linkId: string) {
  await lnbits(`/lnurlp/api/v1/links/${linkId}`, wallet.adminkey, { method: 'DELETE' })
}

export function lightningAddressFor(username: string) {
  return `${username}@${new URL(host()).host}`
}

// Balance in sats, read with the wallet's invoice (read-only) key.
export async function getWalletBalanceSats(inkey: string): Promise<number> {
  const wallet = await lnbits('/api/v1/wallet', inkey)
  return Math.floor((wallet.balance ?? 0) / 1000) // LNbits reports millisats
}

// Optional: check a wallet's recent payments via the invoice/read key.
// Not required for the core flow (the Bitika webhook already drives the DB),
// useful as a secondary confirmation signal during debugging/demo.
export async function checkWalletPayments(inkey: string) {
  return lnbits('/api/v1/payments', inkey)
}
