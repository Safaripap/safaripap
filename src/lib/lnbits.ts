// LNbits helpers — used mainly by scripts/onboard-vehicle.ts.
// Uses a hosted instance (default: https://legend.lnbits.com) so nothing needs
// to be self-hosted for the hackathon.

const LNBITS_HOST = process.env.LNBITS_HOST || 'https://legend.lnbits.com'

export interface LnbitsWallet {
  id: string
  adminkey: string
  inkey: string
}

export async function createUserWallet(userName: string, walletName: string): Promise<LnbitsWallet> {
  const res = await fetch(`${LNBITS_HOST}/usermanager/api/v1/users`, {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.LNBITS_ADMIN_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      admin_id: process.env.LNBITS_ADMIN_ID,
      user_name: userName,
      wallet_name: walletName,
    }),
  })
  if (!res.ok) throw new Error(`LNbits createUserWallet failed: ${res.status} ${await res.text()}`)
  const user = await res.json()
  return user.wallets[0]
}

export async function createLnurlpLink(wallet: LnbitsWallet, description: string): Promise<{ username: string }> {
  const res = await fetch(`${LNBITS_HOST}/lnurlp/api/v1/links`, {
    method: 'POST',
    headers: {
      'X-Api-Key': wallet.adminkey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
      min: 10,
      max: 500000,
      comment_chars: 0,
    }),
  })
  if (!res.ok) throw new Error(`LNbits createLnurlpLink failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export function lightningAddressFor(username: string) {
  return `${username}@${new URL(LNBITS_HOST).host}`
}

// Optional: check a wallet's recent payments via the invoice/read key.
// Not required for the core flow (the Bitika webhook already drives the DB),
// useful as a secondary confirmation signal during debugging/demo.
export async function checkWalletPayments(inkey: string) {
  const res = await fetch(`${LNBITS_HOST}/api/v1/payments`, {
    headers: { 'X-Api-Key': inkey },
  })
  if (!res.ok) throw new Error(`LNbits checkWalletPayments failed: ${res.status}`)
  return res.json()
}
