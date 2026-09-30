import { SafaripapLogo } from '@/components/SafaripapLogo'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-6">
        <SafaripapLogo size="lg" />
      </h1>
      <p className="text-lg text-brand-dark/70 max-w-sm">
        Scan the QR code in the vehicle, or visit <code>/pay/&lt;vehicle-code&gt;</code> to pay a fare.
        Conductors: sign in at <code>/login</code>.
      </p>
    </main>
  )
}
