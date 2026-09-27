// Run once per vehicle: `npm run create-conductor KAB123B 482913`
// Creates (or resets) the conductor login for a vehicle and links it, so the
// conductor can sign in at /login with the vehicle code + PIN.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { conductorEmail, PIN_LENGTH } from '../src/lib/conductor'

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

  let userId = vehicle.conductor_user_id as string | null
  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: pin })
    if (error) throw error
    console.log(`Reset PIN for ${vehicleCode}.`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: conductorEmail(vehicleCode),
      password: pin,
      email_confirm: true,
      user_metadata: { vehicle_code: vehicleCode },
    })
    if (error) throw error
    userId = data.user.id

    const { error: linkError } = await supabase
      .from('vehicles')
      .update({ conductor_user_id: userId })
      .eq('id', vehicle.id)
    if (linkError) throw linkError
    console.log(`Created conductor login for ${vehicleCode}.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
