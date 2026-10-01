import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'

// Join requests, newest first; new ones before handled ones.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    return NextResponse.json(
      { error: 'Could not load requests. Has the 20261001_onboarding_requests.sql migration been run?' },
      { status: 500 }
    )
  }
  const rank = (s: string) => (s === 'new' ? 0 : 1)
  return NextResponse.json({ requests: [...(data ?? [])].sort((a, b) => rank(a.status) - rank(b.status)) })
}
