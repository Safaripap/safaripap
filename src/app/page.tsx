import { SafaripapLogo } from '@/components/SafaripapLogo'
import { SettingsMenu } from '@/components/SettingsMenu'

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute right-4 top-4">
        <SettingsMenu />
      </div>
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
