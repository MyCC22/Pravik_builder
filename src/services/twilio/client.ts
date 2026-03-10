import twilio from 'twilio'
import { validateRequest } from 'twilio/lib/webhooks/webhooks'

let client: twilio.Twilio | null = null

function getClient() {
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return client
}

export async function verifyWebhookSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): Promise<boolean> {
  return validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
}

export async function sendSMS(to: string, body: string): Promise<string> {
  const message = await getClient().messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  })
  return message.sid
}

export function generateTwiML(message: string, smsBody?: string, smsTo?: string): string {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>'

  if (smsBody && smsTo) {
    twiml += `\n  <Message to="${smsTo}">${escapeXml(smsBody)}</Message>`
  }

  twiml += `\n  <Say voice="alice">${escapeXml(message)}</Say>`
  twiml += '\n</Response>'
  return twiml
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
