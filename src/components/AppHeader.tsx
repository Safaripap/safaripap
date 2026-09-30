import { SafaripapLogo } from './SafaripapLogo'
import { SettingsMenu } from './SettingsMenu'

// Shared top of every screen: logo and settings on one row, the vehicle's
// route plate on its own row underneath so nothing collides on a 320px phone.
export function AppHeader({ plate, alerts = false }: { plate?: string | null; alerts?: boolean }) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <SafaripapLogo size="sm" />
        <SettingsMenu alerts={alerts} />
      </div>
      {plate && (
        <div className="mt-4">
          <span className="route-plate">{plate}</span>
        </div>
      )}
    </header>
  )
}
