import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/twilio/client'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Verify Twilio signature
    const signature = req.headers.get('x-twilio-signature') || ''
    const url = req.url
    const isValid = await verifyWebhookSignature(url, params, signature)

    if (!isValid) {
      console.warn('Invalid Twilio status webhook signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const callSid = params.CallSid || ''
    const callStatus = params.CallStatus || ''
    const callDuration = params.CallDuration || ''
    const from = params.From || ''
    const to = params.To || ''

    console.log(`Call status update: ${callSid} - ${callStatus} (duration: ${callDuration}s) from ${from} to ${to}`)

    // Handle specific statuses if needed
    switch (callStatus) {
      case 'completed':
        console.log(`Call ${callSid} completed after ${callDuration}s`)
        break
      case 'busy':
      case 'no-answer':
      case 'failed':
      case 'canceled':
        console.log(`Call ${callSid} ended with status: ${callStatus}`)
        break
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Twilio status webhook error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
