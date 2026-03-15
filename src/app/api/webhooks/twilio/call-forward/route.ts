import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { generateAfterHoursStreamTwiML } from '@/services/twilio/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AfterHoursSchedule {
  open: string   // "09:00" (HH:MM 24-hour)
  close: string  // "17:00"
  days: number[] // ISO day numbers: 1=Mon..7=Sun
}

interface AfterHoursConfig {
  enabled: boolean
  timezone: string       // IANA timezone e.g. "America/Chicago"
  schedule: AfterHoursSchedule
  greeting_name: string  // Business name for AI greeting
  transfer_enabled: boolean
}

// ---------------------------------------------------------------------------
// Time-based routing logic
// ---------------------------------------------------------------------------

/**
 * Check if the current time is within business hours for the given config.
 *
 * Uses Intl.DateTimeFormat to reliably convert to the configured timezone.
 * Returns true if within hours (should forward to owner), false if after hours.
 */
function isWithinBusinessHours(config: AfterHoursConfig): boolean {
  const { timezone, schedule } = config

  try {
    const now = new Date()

    // Get current hour, minute, and weekday in the configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
    })
    const parts = formatter.formatToParts(now)

    const hourStr = parts.find(p => p.type === 'hour')?.value || '0'
    const minuteStr = parts.find(p => p.type === 'minute')?.value || '0'
    const dayName = parts.find(p => p.type === 'weekday')?.value || ''

    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)

    // Map weekday abbreviation to ISO day number
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    }
    const dayNum = dayMap[dayName] || 0

    // Check if today is a business day
    if (!schedule.days.includes(dayNum)) {
      return false
    }

    // Check if current time is within open/close window
    const currentMinutes = hour * 60 + minute
    const [openH, openM] = schedule.open.split(':').map(Number)
    const [closeH, closeM] = schedule.close.split(':').map(Number)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } catch (err) {
    // If timezone parsing fails, default to forwarding (safer than blocking)
    console.error('isWithinBusinessHours error:', err)
    return true
  }
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Twilio voice webhook for provisioned phone numbers.
 *
 * When someone calls a provisioned business number, Twilio POSTs here.
 * We look up which project owns the number, check for after-hours AI config,
 * and either:
 *   - Forward (dial) to the owner's phone (during business hours or no AI config)
 *   - Connect to the voice AI server (after business hours)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const calledNumber = formData.get('Called')?.toString() || ''
    const callerPhone = formData.get('From')?.toString() || ''
    const callSid = formData.get('CallSid')?.toString() || ''

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
      .select('id, user_id, forwarding_phone')
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

    // --- Check for after-hours AI config ---
    const { data: ahTool } = await supabase
      .from('tools')
      .select('id, config')
      .eq('project_id', project.id)
      .eq('tool_type', 'after_hours_ai')
      .eq('is_active', true)
      .single()

    const ahConfig = ahTool?.config as AfterHoursConfig | null

    if (ahConfig?.enabled && !isWithinBusinessHours(ahConfig)) {
      // AFTER HOURS — connect to voice AI server
      const voiceServerUrl = (
        process.env.VOICE_SERVER_WS_URL ||
        'wss://pravik-voice-server.up.railway.app/media-stream'
      ).trim()

      console.log(
        `Call-forward: AFTER HOURS — ${calledNumber} from ${callerPhone} -> AI assistant for "${ahConfig.greeting_name}"`
      )

      const twiml = generateAfterHoursStreamTwiML({
        websocketUrl: voiceServerUrl,
        callSid,
        callerPhone,
        projectId: project.id,
        businessName: ahConfig.greeting_name || 'the business',
        forwardingPhone: forwardTo,
        toolId: ahTool!.id,
        transferEnabled: ahConfig.transfer_enabled ?? true,
      })

      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // WITHIN HOURS (or no AI config) — forward to owner's phone
    console.log(`Call-forward: ${calledNumber} -> ${forwardTo}`)

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
