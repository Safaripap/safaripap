// Onboard a vehicle from the terminal — the same steps as /admin/onboard:
//   npm run onboard-vehicle -- KAB123B "John Kamau" --sacco <sacco_id> [--fare 50] [--pin 482913]
//   npm run onboard-vehicle -- KAB123B "John Kamau" --new-sacco "Super Metro" [--fare 50]
// Prints the Lightning Address and the conductor PIN (generated if not given).

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { onboardVehicle, STEPS } from '../src/lib/onboarding'

function flag(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const [vehicleCode, conductorName] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'))
  if (!vehicleCode || !conductorName || (!flag('sacco') && !flag('new-sacco'))) {
    console.error('Usage: onboard-vehicle <vehicleCode> <conductorName> (--sacco <id> | --new-sacco <name>) [--fare <kes>] [--pin <6 digits>]')
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const label = (id: string) => STEPS.find((s) => s.id === id)?.label ?? id

  const result = await onboardVehicle(
    supabase,
    {
      vehicleCode,
      conductorName,
      saccoId: flag('sacco'),
      newSaccoName: flag('new-sacco'),
      presetFareKes: flag('fare') ? parseInt(flag('fare')!, 10) : null,
      pin: flag('pin'),
    },
    (e) => {
      if (e.type === 'step' && e.status === 'done') console.log(`✓ ${label(e.step)}${e.detail ? ` — ${e.detail}` : ''}`)
      if (e.type === 'failed') console.error(`✗ ${label(e.step)}: ${e.error}`)
    }
  )

  console.log(`\n${result.vehicleCode} onboarded.`)
  console.log(`Lightning Address: ${result.lightningAddress}`)
  console.log(`Conductor PIN:     ${result.pin}  (sign in at /login)`)
}

main().catch(() => process.exit(1))
