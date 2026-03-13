"""Quick test: send an SMS via Twilio Messaging Service and check delivery status."""

import sys
import time
from twilio.rest import Client

ACCOUNT_SID = "AC54bbf469e8a35c8057c444cf88b7724c"
AUTH_TOKEN = "3d99c0a4ef68b65c7116659512f04f4d"
MESSAGING_SERVICE_SID = "MG1d3e16ad286035921d09f91ff98db654"
TO_NUMBER = "+12177214157"  # User's phone from Twilio params

client = Client(ACCOUNT_SID, AUTH_TOKEN)

try:
    message = client.messages.create(
        to=TO_NUMBER,
        messaging_service_sid=MESSAGING_SERVICE_SID,
        body="Test SMS from Pravik Builder — if you see this, SMS is working!",
    )
    print(f"Sent — SID: {message.sid}, Status: {message.status}")

    # Poll for delivery status
    for i in range(10):
        time.sleep(2)
        msg = client.messages(message.sid).fetch()
        print(f"  [{i*2+2}s] Status: {msg.status}, Error: {msg.error_code} {msg.error_message or ''}")
        if msg.status in ("delivered", "undelivered", "failed"):
            break

    print(f"\nFinal status: {msg.status}")
    if msg.error_code:
        print(f"Error code: {msg.error_code}")
        print(f"Error message: {msg.error_message}")

except Exception as e:
    print(f"FAILED — {type(e).__name__}: {e}")
    sys.exit(1)
