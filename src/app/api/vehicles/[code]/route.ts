import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('vehicle_code, preset_fare_kes')
    .eq('vehicle_code', params.code.toUpperCase())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Unknown vehicle code' }, { status: 404 })
  }
  return NextResponse.json(data)
}
