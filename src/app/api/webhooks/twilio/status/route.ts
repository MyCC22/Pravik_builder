import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/twilio/client'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Verify Twilio signature
    const signature = req.headers.get('x-twilio-signature') || ''
    const host = req.headers.get('host') || 'pravik-builder.vercel.app'
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const publicUrl = `${proto}://${host}/api/webhooks/twilio/status`
    const isValid = await verifyWebhookSignature(publicUrl, params, signature)

    if (!isValid) {
      console.warn('Invalid Twilio status webhook signature', { publicUrl })
    }

    const callSid = params.CallSid || ''
    const callStatus = params.CallStatus || ''
    const callDuration = params.CallDuration || ''

    console.log(`Call status: ${callSid} - ${callStatus} (${callDuration}s)`)

    // Update call_sessions on call completion
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)) {
      const supabase = getSupabaseClient()
      await supabase
        .from('call_sessions')
        .update({
          state: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('call_sid', callSid)
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Twilio status webhook error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
