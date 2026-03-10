import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { verifyWebhookSignature, sendSMS, generateTwiML } from '@/services/twilio/client'

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'pravik-builder.vercel.app'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    // Verify Twilio signature using the public-facing URL
    const signature = req.headers.get('x-twilio-signature') || ''
    const publicUrl = `${getBaseUrl(req)}/api/webhooks/twilio`
    const isValid = await verifyWebhookSignature(publicUrl, params, signature)

    if (!isValid) {
      console.warn('Invalid Twilio webhook signature', { publicUrl, signature: signature.substring(0, 10) })
    }

    const callerPhone = params.From || ''
    const callSid = params.CallSid || ''

    if (!callerPhone) {
      return new NextResponse(
        generateTwiML('Sorry, we could not identify your phone number.'),
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const supabase = getSupabaseClient()

    // Look up or create user by phone
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', callerPhone)
      .single()

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ phone_number: callerPhone })
        .select()
        .single()

      if (error) throw error
      user = newUser
    }

    // Create a session for this call
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        phone_number: callerPhone,
        source: 'twilio',
        session_token: callSid,
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Create a new project for this call
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: `Phone Build ${new Date().toLocaleDateString()}`,
      })
      .select()
      .single()

    if (projectError) throw projectError

    // Send SMS with builder link
    const baseUrl = getBaseUrl(req)
    const builderUrl = `${baseUrl}/build/${project.id}?session=${session.session_token}`
    const smsBody = `Welcome to Pravik Builder! Open this link to start building your website: ${builderUrl}`

    await sendSMS(callerPhone, smsBody)

    // Return TwiML voice response
    const twiml = generateTwiML(
      'Welcome to the new world! We just sent you a text message with a link to start building your website. Open it on your phone to get started. Goodbye!'
    )

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('Twilio webhook error:', error)
    const twiml = generateTwiML(
      'Sorry, something went wrong. Please try again later.'
    )
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
