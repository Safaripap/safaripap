import { SafaripapLogo } from './SafaripapLogo'

// The printable sticker card. It's the only thing visible when printing
// (see the print rules for #sticker in globals.css).
export function Sticker({ vehicleCode, payUrl, qrSvg }: { vehicleCode: string; payUrl: string; qrSvg: string }) {
  return (
    <div id="sticker" className="ticket-stub text-center motion-fade-up">
      <div className="flex justify-center mb-4">
        <SafaripapLogo />
      </div>
      <p className="text-xl font-semibold mb-4">Scan to pay your fare</p>
      <div
        className="mx-auto w-full max-w-[16rem] [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        aria-label={`QR code linking to ${payUrl}`}
        // Generated server-side by the qrcode library from our own URL.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <p className="mt-5 text-base text-brand-dark/70">No camera? Open Safaripap, tap Pay a fare and enter</p>
      <p className="mt-2 font-display text-5xl font-extrabold tabular-nums tracking-wide">{vehicleCode}</p>
      <p className="mt-3 text-sm text-brand-dark/70 break-all">{payUrl}</p>
    </div>
  )
}
