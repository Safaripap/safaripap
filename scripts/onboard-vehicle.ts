// Run once per new vehicle: `npx tsx scripts/onboard-vehicle.ts KAB123B "John Kamau" <sacco_id> [preset_fare_kes]`
// Creates an LNbits wallet + a static Lightning Address for the vehicle, then
// inserts the vehicle row into Supabase.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createUserWallet, createLnurlpLink, lightningAddressFor } from '../src/lib/lnbits'

async function main() {
  const [vehicleCode, conductorName, saccoId, presetFareArg] = process.argv.slice(2)
  if (!vehicleCode || !conductorName) {
    console.error('Usage: onboard-vehicle <vehicleCode> <conductorName> [saccoId] [presetFareKes]')
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  console.log(`Creating LNbits wallet for ${vehicleCode}...`)
  const wallet = await createUserWallet(vehicleCode, `${vehicleCode} fares`)

  console.log(`Creating LNURLp pay link...`)
  const payLink = await createLnurlpLink(wallet, `${vehicleCode} fare payments`)
  const lightningAddress = lightningAddressFor(payLink.username)

  console.log(`Lightning Address: ${lightningAddress}`)

  const { error } = await supabase.from('vehicles').insert({
    vehicle_code: vehicleCode,
    conductor_name: conductorName,
    sacco_id: saccoId || null,
    preset_fare_kes: presetFareArg ? parseInt(presetFareArg, 10) : null,
    lnbits_wallet_id: wallet.id,
    lnbits_invoice_key: wallet.inkey,
    lightning_address: lightningAddress,
  })

  if (error) throw error
  console.log(`Vehicle ${vehicleCode} onboarded.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
