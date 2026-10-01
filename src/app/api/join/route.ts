import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { toJoinRequest, validateJoin, type JoinInput } from '@/lib/join'

// Public: a sacco or matatu owner asks to join. Nothing is created except the
// request itself; staff review it in /admin/requests. A hidden "website" field
// catches bots, and the same phone can't send another request for 10 minutes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 400 })

  // Bots fill every field; people never see this one. Pretend it worked.
  if (body.website) return NextResponse.json({ received: true })

  const input: JoinInput = {
    saccoName: String(body.saccoName ?? ''),
    contactName: String(body.contactName ?? ''),
    phone: String(body.phone ?? ''),
    role: body.role,
    matatuCount: Number(body.matatuCount),
    plates: String(body.plates ?? ''),
    notes: body.notes == null ? '' : String(body.notes),
  }
  const invalid = validateJoin(input)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const request = toJoinRequest(input)

  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: recent } = await supabaseAdmin
    .from('onboarding_requests')
    .select('id')
    .eq('phone', request.phone)
    .gte('created_at', since)
    .limit(1)
  if (recent?.length) return NextResponse.json({ received: true })

  const { error } = await supabaseAdmin.from('onboarding_requests').insert(request)
  if (error) return NextResponse.json({ error: 'Couldn’t send your request. Try again in a minute.' }, { status: 500 })
  return NextResponse.json({ received: true })
}
