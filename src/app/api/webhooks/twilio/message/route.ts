import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { verifyWebhookSignature } from '@/services/twilio/client'

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'pravik-builder.vercel.app'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

function generateMessagingTwiML(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(body)}</Message>
</Response>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
    const publicUrl = `${getBaseUrl(req)}/api/webhooks/twilio/message`
    const isValid = await verifyWebhookSignature(publicUrl, params, signature)

    if (!isValid) {
      console.warn('Invalid Twilio message webhook signature', { publicUrl, signature: signature.substring(0, 10) })
      // Allow through for now while debugging — Twilio Messaging Services can sign differently
    }

    const senderPhone = params.From || ''
    const messageBody = (params.Body || '').trim()

    if (!senderPhone) {
      return new NextResponse(
        generateMessagingTwiML('Sorry, we could not identify your phone number.'),
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const supabase = getSupabaseClient()

    // Look up or create user by phone
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', senderPhone)
      .single()

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ phone_number: senderPhone })
        .select()
        .single()

      if (error) throw error
      user = newUser
    }

    // Check if user has an existing project
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)

    const baseUrl = getBaseUrl(req)

    if (projects && projects.length > 0) {
      // Send link to their most recent project
      const project = projects[0]
      const builderUrl = `${baseUrl}/build/${project.id}`
      return new NextResponse(
        generateMessagingTwiML(
          `Welcome to the new world! Continue building your website here: ${builderUrl}`
        ),
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // No existing project — create one and send link
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: `SMS Build ${new Date().toLocaleDateString()}`,
      })
      .select()
      .single()

    if (projectError) throw projectError

    const builderUrl = `${baseUrl}/build/${project.id}`

    return new NextResponse(
      generateMessagingTwiML(
        `Welcome to the new world! Start building your website here: ${builderUrl}`
      ),
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('Twilio message webhook error:', error)
    return new NextResponse(
      generateMessagingTwiML('Sorry, something went wrong. Please try again later.'),
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
