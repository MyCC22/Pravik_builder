import twilio from 'twilio'

let client: twilio.Twilio | null = null

function getClient(): twilio.Twilio {
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return client
}

export async function sendSMS(to: string, body: string): Promise<string> {
  const message = await getClient().messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  })
  return message.sid
}
