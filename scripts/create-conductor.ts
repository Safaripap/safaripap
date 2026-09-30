// Run once per vehicle: `npm run create-conductor KAB123B 482913`
// Creates (or resets) the conductor login for a vehicle and links it, so the
// conductor can sign in at /login with the vehicle code + PIN.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { PIN_LENGTH } from '../src/lib/conductor'
import { createConductorLogin } from '../src/lib/onboarding'

async function main() {
  const [vehicleCodeArg, pin] = process.argv.slice(2)
  if (!vehicleCodeArg || !pin || !new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    console.error(`Usage: create-conductor <vehicleCode> <${PIN_LENGTH}-digit PIN>`)
    process.exit(1)
  }
  const vehicleCode = vehicleCodeArg.toUpperCase()

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, conductor_user_id')
    .eq('vehicle_code', vehicleCode)
    .single()
  if (vehicleError || !vehicle) throw new Error(`Vehicle ${vehicleCode} not found`)

  const { created } = await createConductorLogin(supabase, vehicle, vehicleCode, pin)
  console.log(created ? `Created conductor login for ${vehicleCode}.` : `Reset PIN for ${vehicleCode}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
