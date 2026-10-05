import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { settleTransaction } from '@/lib/treasury'

// Manual settlement retry for a Daraja fare (e.g. after topping up a
// low treasury). Ported from Nauli Sacco; guarded by the admin session here
// instead of Nauli's demo PIN.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 })

  try {
    const result = await settleTransaction(params.id)
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  } catch (e) {
    console.error(`settle ${params.id} failed`, e)
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 502 })
  }
}
