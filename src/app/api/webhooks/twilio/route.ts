import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Placeholder for Twilio webhook
  const body = await req.text()
  console.log('Twilio webhook received:', body)

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Thank you for calling Pravik Builder. This feature is coming soon.</Say>
    </Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
