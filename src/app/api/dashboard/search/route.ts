import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Full-receipt search for the conductor dashboard. The browser only ever
// holds receipt_last3, so a longer receipt query is matched here against the
// stored mpesa_receipt. Phone numbers are deliberately not searchable beyond
// the last 3 digits the dashboard already has.
//
// Only suffix matches of 4+ characters count, so a conductor can't browse
// receipts by typing one letter. The full receipt is returned for matching
// rows only — the conductor has just typed it, so it tells them nothing new.
export async function GET(req: NextRequest) {
  const vehicleCode = req.nextUrl.searchParams.get('vehicle')?.toUpperCase()
  const q = (req.nextUrl.searchParams.get('q') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!vehicleCode || q.length < 4 || q.length > 20) {
    return NextResponse.json({ error: 'Search needs a vehicle and 4–20 characters' }, { status: 400 })
  }

  // The service role bypasses RLS, so check the caller is this vehicle's conductor.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: vehicle } = await supabaseAdmin
    .from('vehicles')
    .select('id, conductor_user_id')
    .eq('vehicle_code', vehicleCode)
    .single()
  if (!vehicle || vehicle.conductor_user_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your vehicle' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, amount_kes, phone_last3, receipt_last3, status, verified_by_conductor, created_at, mpesa_receipt')
    .eq('vehicle_id', vehicle.id)
    .ilike('mpesa_receipt', `%${q}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  return NextResponse.json({ results: data ?? [] })
}
