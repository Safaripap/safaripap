import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'
import { makeSticker, stickerOrigin } from '@/lib/sticker'

// GET ?vehicle=CODE → the matatu's QR sticker, for reprinting. Demo matatus
// have no sticker: they can't take payments.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const code = (req.nextUrl.searchParams.get('vehicle') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!code) return NextResponse.json({ error: 'Choose a matatu.' }, { status: 400 })

  const { data: vehicle } = await supabaseAdmin.from('vehicles').select('*').eq('vehicle_code', code).maybeSingle()
  if (!vehicle) return NextResponse.json({ error: `No matatu is registered as ${code}.` }, { status: 404 })
  if (vehicle.is_demo) {
    return NextResponse.json({ error: `${code} is a demo matatu: it can’t take payments, so it has no sticker.` }, { status: 400 })
  }
  return NextResponse.json(await makeSticker(vehicle.vehicle_code, stickerOrigin(req.nextUrl.origin)))
}
