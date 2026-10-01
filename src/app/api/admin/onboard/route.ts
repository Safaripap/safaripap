import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'
import { onboardVehicle, validateOnboardInput, type OnboardInput } from '@/lib/onboarding'
import { makeSticker, stickerOrigin } from '@/lib/sticker'

// Onboards a vehicle and streams progress as newline-delimited JSON, one
// event per line, so the admin screen can tick each step off as it happens:
//   {"type":"step","step":"wallet","status":"running"}
//   {"type":"step","step":"wallet","status":"done","detail":"KAB456C fares"}
//   ...
//   {"type":"result", ...}           or   {"type":"failed","step":...,"error":...}
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const input: OnboardInput = {
    vehicleCode: String(body?.vehicleCode ?? ''),
    conductorName: String(body?.conductorName ?? ''),
    presetFareKes: body?.presetFareKes == null || body.presetFareKes === '' ? null : Number(body.presetFareKes),
    saccoId: body?.saccoId || null,
    newSaccoName: body?.newSaccoName || null,
  }
  const invalid = validateOnboardInput(input)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const origin = stickerOrigin(req.nextUrl.origin)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      try {
        const result = await onboardVehicle(supabaseAdmin, input, send)
        const { payUrl, qrSvg } = await makeSticker(result.vehicleCode, origin)
        send({ type: 'result', ...result, payUrl, qrSvg })
      } catch {
        // onboardVehicle already sent a 'failed' event and rolled back.
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
