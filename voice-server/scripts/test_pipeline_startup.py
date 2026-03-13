"""Smoke test: connect to voice server like Twilio would, verify pipeline starts.

Usage:
    python scripts/test_pipeline_startup.py [url]

Default URL: wss://adequate-integrity-production.up.railway.app/media-stream
"""

import asyncio
import json
import sys
import uuid

import websockets


async def test_pipeline_startup(url: str):
    """Simulate Twilio's initial WebSocket handshake and verify the server handles it."""
    print(f"Connecting to {url} ...")

    try:
        async with websockets.connect(url, open_timeout=15) as ws:
            print("Connected! Sending Twilio 'connected' event...")

            # 1. Twilio sends "connected"
            await ws.send(json.dumps({"event": "connected", "protocol": "Call", "version": "1.0.0"}))
            await asyncio.sleep(0.3)

            # 2. Twilio sends "start" with metadata
            start_msg = {
                "event": "start",
                "sequenceNumber": "1",
                "start": {
                    "accountSid": "ACtest",
                    "streamSid": "MZtest_stream_sid",
                    "callSid": f"CAtest_{uuid.uuid4().hex[:16]}",
                    "tracks": ["inbound"],
                    "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000, "channels": 1},
                    "customParameters": {
                        "callSid": f"CAtest_{uuid.uuid4().hex[:16]}",
                        "projectId": "9943ec3b-2355-41bc-a662-384f05a8e5d6",
                        "userId": "baa937f5-1866-45a1-818f-ed199855809e",
                        "isNewUser": "false",
                        "phoneNumber": "+10000000000",
                    },
                },
                "streamSid": "MZtest_stream_sid",
            }
            print("Sending Twilio 'start' event...")
            await ws.send(json.dumps(start_msg))

            # 3. Wait for server to process — if pipeline crashes, the WS will close
            print("Waiting 5s for pipeline to initialize...")
            try:
                # Try receiving any message from server (audio, etc.)
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"Received message from server ({len(msg)} bytes) — pipeline is running!")
            except asyncio.TimeoutError:
                # Timeout is OK — means server is still connected, just no audio yet
                print("No message received (timeout) but connection is still alive — pipeline started OK!")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"ERROR: Server closed connection: code={e.code}, reason={e.reason}")
                print("Pipeline likely crashed during initialization.")
                return False

            # 4. Send a "stop" to cleanly disconnect
            await ws.send(json.dumps({"event": "stop", "sequenceNumber": "2", "streamSid": "MZtest_stream_sid"}))
            print("Sent 'stop' event. Test PASSED — pipeline started successfully!")
            return True

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"ERROR: Server rejected WebSocket: status={e.status_code}")
        return False
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "wss://adequate-integrity-production.up.railway.app/media-stream"
    success = asyncio.run(test_pipeline_startup(url))
    sys.exit(0 if success else 1)
