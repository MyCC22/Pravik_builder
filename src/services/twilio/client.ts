// Twilio service - placeholder for Step 2
// Will handle: webhook signature verification, SMS sending, call management

export async function verifyWebhookSignature(_request: Request): Promise<boolean> {
  // TODO: Implement with Twilio auth token
  return true
}

export async function sendSMS(_to: string, _body: string): Promise<void> {
  // TODO: Implement with Twilio client
  throw new Error('Twilio not configured yet')
}
