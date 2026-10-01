// The QR sticker inside each matatu: a QR code for its pay page. Used when a
// matatu is onboarded and when a sticker is reprinted from /admin/stickers.
import QRCode from 'qrcode'

// Where stickers point. NEXT_PUBLIC_APP_URL (the deployed site) wins, so a
// sticker printed from a laptop never points at localhost; otherwise the
// address the admin is using.
export function stickerOrigin(requestOrigin: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/$/, '')
}

// A sticker pointing at localhost or a LAN address only works on this computer.
export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)
  } catch {
    return true
  }
}

export interface Sticker {
  vehicleCode: string
  payUrl: string
  qrSvg: string
  local: boolean
}

export async function makeSticker(vehicleCode: string, origin: string): Promise<Sticker> {
  const payUrl = `${origin}/pay/${vehicleCode}`
  const qrSvg = await QRCode.toString(payUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return { vehicleCode, payUrl, qrSvg, local: isLocalOrigin(origin) }
}
