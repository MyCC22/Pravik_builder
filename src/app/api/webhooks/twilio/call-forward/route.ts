import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

/**
 * Twilio voice webhook for provisioned phone numbers.
 *
 * When someone calls a provisioned business number, Twilio POSTs here.
 * We look up which project owns the number, find the owner's real phone,
 * and return TwiML that forwards (dials) the call to them.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const calledNumber = formData.get('Called')?.toString() || ''

    if (!calledNumber) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const supabase = getSupabaseClient()

    // Find the project that owns this provisioned number
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id, forwarding_phone')
      .eq('provisioned_phone', calledNumber)
      .single()

    if (projectError || !project) {
      console.error('Call-forward: no project found for number', calledNumber)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not currently active. Goodbye.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Use project-level forwarding number if set, otherwise fall back to user's phone
    let forwardTo = project.forwarding_phone

    if (!forwardTo) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('phone_number')
        .eq('id', project.user_id)
        .single()

      if (userError || !user?.phone_number) {
        console.error('Call-forward: no forwarding phone found for project', calledNumber)
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not connect your call. Please try again later.</Say></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      forwardTo = user.phone_number
    }

    console.log(`Call-forward: ${calledNumber} -> ${forwardTo}`)

    // Return TwiML that dials the owner's phone
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(calledNumber)}">${escapeXml(forwardTo)}</Dial>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('Call-forward webhook error:', error)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. Please try again later.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
