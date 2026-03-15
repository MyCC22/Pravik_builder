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

export function generateMediaStreamTwiML(params: {
  websocketUrl: string
  callSid: string
  projectId: string
  userId: string
  isNewUser: boolean
  phoneNumber: string
  projectCount: number
  latestProjectId: string
  latestProjectName: string
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(params.websocketUrl)}">
      <Parameter name="callSid" value="${escapeXml(params.callSid)}" />
      <Parameter name="projectId" value="${escapeXml(params.projectId)}" />
      <Parameter name="userId" value="${escapeXml(params.userId)}" />
      <Parameter name="isNewUser" value="${params.isNewUser ? 'true' : 'false'}" />
      <Parameter name="phoneNumber" value="${escapeXml(params.phoneNumber)}" />
      <Parameter name="projectCount" value="${params.projectCount}" />
      <Parameter name="latestProjectId" value="${escapeXml(params.latestProjectId)}" />
      <Parameter name="latestProjectName" value="${escapeXml(params.latestProjectName)}" />
    </Stream>
  </Connect>
</Response>`
}

export function generateAfterHoursStreamTwiML(params: {
  websocketUrl: string
  callSid: string
  callerPhone: string
  projectId: string
  businessName: string
  forwardingPhone: string
  toolId: string
  transferEnabled: boolean
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(params.websocketUrl)}">
      <Parameter name="mode" value="after_hours" />
      <Parameter name="callSid" value="${escapeXml(params.callSid)}" />
      <Parameter name="callerPhone" value="${escapeXml(params.callerPhone)}" />
      <Parameter name="projectId" value="${escapeXml(params.projectId)}" />
      <Parameter name="businessName" value="${escapeXml(params.businessName)}" />
      <Parameter name="forwardingPhone" value="${escapeXml(params.forwardingPhone)}" />
      <Parameter name="toolId" value="${escapeXml(params.toolId)}" />
      <Parameter name="transferEnabled" value="${params.transferEnabled ? 'true' : 'false'}" />
    </Stream>
  </Connect>
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
