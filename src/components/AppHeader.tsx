import Link from 'next/link'
import { SafaripapLogo } from './SafaripapLogo'
import { SettingsMenu } from './SettingsMenu'
import { BackButton } from './BackButton'

// Shared top of every screen: an optional back button, the logo (which always
// goes home) and settings on one row, the vehicle's route plate on its own row
// underneath so nothing collides on a 320px phone.
export function AppHeader({
  plate,
  alerts = false,
  back,
  actions,
}: {
  plate?: string | null
  alerts?: boolean
  back?: { href: string; label: string }
  actions?: React.ReactNode // extra controls beside settings, e.g. sign out
}) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {back && <BackButton href={back.href} label={back.label} />}
          <Link href="/" aria-label="Safaripap home" className="inline-flex min-h-[3.25rem] items-center rounded-lg">
            <SafaripapLogo size="sm" wordmark={!back} />
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <SettingsMenu alerts={alerts} />
        </div>
      </div>
      {plate && (
        <div className="mt-4">
          <span className="route-plate">{plate}</span>
        </div>
      )}
    </header>
  )
}
