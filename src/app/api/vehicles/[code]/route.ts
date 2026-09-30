import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', params.code.toUpperCase())
    .single()

  // Demo matatus look like any unknown code to passengers: they can't be paid.
  if (error || !data || data.is_demo) {
    return NextResponse.json({ error: 'Unknown vehicle code' }, { status: 404 })
  }
  // Only what the pay screen needs — never the wallet keys.
  return NextResponse.json({ vehicle_code: data.vehicle_code, preset_fare_kes: data.preset_fare_kes })
}
