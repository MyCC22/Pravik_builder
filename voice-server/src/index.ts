import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyFormbody from '@fastify/formbody'
import { WebSocket } from 'ws'
import { TOOLS, executeTool, type ToolContext } from './tools.js'
import {
  createCallSession,
  endCallSession,
  saveCallMessage,
} from './services/call-session.js'
import {
  subscribeToCallChannel,
  broadcastCallEnded,
  cleanupChannel,
} from './services/realtime.js'

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = process.env.HOST || '0.0.0.0'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const BUILDER_API_URL = process.env.BUILDER_API_URL || 'https://pravik-builder.vercel.app'

const SYSTEM_INSTRUCTIONS = `You are a friendly, warm AI assistant for Pravik Builder — a service that helps people create beautiful websites through conversation over the phone.

Your personality:
- Warm, encouraging, and conversational — like a helpful friend
- Keep responses SHORT (1-3 sentences). This is a phone call, not a text chat.
- Never use markdown, URLs, emojis, or technical jargon
- Be enthusiastic but not over-the-top

Call flow:
1. GREET the caller. If they're new, welcome them and explain you can help build a website in minutes. Ask if they'd like to get started.
2. When they say yes, use the send_builder_link tool to text them a link. Tell them to open it on their phone and that you'll stay on the line.
3. Once they're ready (they may say "I opened it" or just start describing what they want), ask what kind of website they'd like.
4. When they describe their website, use the build_website tool. While waiting, say something like "Let me put that together for you..."
5. After the build completes, tell them to take a look and ask what they think.
6. For changes (colors, text, sections), use edit_website or change_theme tools.
7. When they're satisfied, say a warm goodbye.

Important:
- Always call send_builder_link before building — they need the page open to see the preview.
- After each build/edit action, encourage them to look at their phone to see the changes.
- If they ask about pricing, features, etc., answer briefly and redirect to building.
- Keep the conversation flowing naturally — don't lecture or over-explain.`

async function start() {
  const fastify = Fastify({ logger: true })

  await fastify.register(fastifyFormbody)
  await fastify.register(fastifyWebsocket)

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'pravik-voice-server' }
  })

  // Twilio Media Stream WebSocket endpoint
  fastify.register(async function (fastify) {
    fastify.get('/media-stream', { websocket: true }, (twilioWs, req) => {
      console.log('New Twilio Media Stream connection')

      let streamSid: string | null = null
      let callSid = ''
      let openaiWs: WebSocket | null = null
      let toolCtx: ToolContext | null = null
      let sessionId: string | null = null

      // Connect to OpenAI Realtime API
      function connectToOpenAI() {
        const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17'
        const ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        })

        ws.on('open', () => {
          console.log(`[${callSid}] Connected to OpenAI Realtime API`)
          // Configure the session
          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              voice: 'shimmer',
              instructions: SYSTEM_INSTRUCTIONS,
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
              tools: TOOLS,
            },
          }))
        })

        ws.on('message', async (data) => {
          const event = JSON.parse(data.toString())

          switch (event.type) {
            case 'session.created':
              console.log(`[${callSid}] OpenAI session created`)
              break

            case 'response.audio.delta':
              // Forward AI audio back to Twilio
              if (streamSid && twilioWs.readyState === 1) {
                twilioWs.send(JSON.stringify({
                  event: 'media',
                  streamSid,
                  media: { payload: event.delta },
                }))
              }
              break

            case 'response.audio_transcript.done':
              // Full AI utterance transcript
              if (event.transcript && sessionId) {
                console.log(`[${callSid}] AI: ${event.transcript}`)
                saveCallMessage({
                  callSessionId: sessionId,
                  role: 'assistant',
                  content: event.transcript,
                }).catch(() => {})
              }
              break

            case 'conversation.item.input_audio_transcription.completed':
              // User speech transcript
              if (event.transcript && sessionId) {
                console.log(`[${callSid}] User: ${event.transcript}`)
                saveCallMessage({
                  callSessionId: sessionId,
                  role: 'user',
                  content: event.transcript,
                }).catch(() => {})
              }
              break

            case 'response.function_call_arguments.done':
              // OpenAI wants to call a function tool
              await handleFunctionCall(event, ws)
              break

            case 'input_audio_buffer.speech_started':
              // User started speaking — clear Twilio audio buffer for interruption
              if (streamSid && twilioWs.readyState === 1) {
                twilioWs.send(JSON.stringify({
                  event: 'clear',
                  streamSid,
                }))
              }
              break

            case 'error':
              console.error(`[${callSid}] OpenAI error:`, event.error)
              break
          }
        })

        ws.on('error', (err) => {
          console.error(`[${callSid}] OpenAI WebSocket error:`, err)
        })

        ws.on('close', () => {
          console.log(`[${callSid}] OpenAI WebSocket closed`)
        })

        return ws
      }

      async function handleFunctionCall(event: {
        call_id: string
        name: string
        arguments: string
      }, ws: WebSocket) {
        if (!toolCtx) return

        let args: Record<string, string> = {}
        try {
          args = JSON.parse(event.arguments || '{}')
        } catch {
          args = {}
        }

        const result = await executeTool(event.name, args, toolCtx)

        // Send function result back to OpenAI
        ws.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: event.call_id,
            output: result,
          },
        }))

        // Trigger OpenAI to continue responding
        ws.send(JSON.stringify({ type: 'response.create' }))
      }

      // Handle Twilio Media Stream messages
      twilioWs.on('message', (data) => {
        const msg = JSON.parse(data.toString())

        switch (msg.event) {
          case 'connected':
            console.log('Twilio Media Stream connected')
            break

          case 'start': {
            streamSid = msg.start.streamSid
            callSid = msg.start.callSid

            // Extract custom parameters from TwiML
            const params = msg.start.customParameters || {}
            const userId = params.userId || ''
            const projectId = params.projectId || ''
            const isNewUser = params.isNewUser === 'true'
            const phoneNumber = params.phoneNumber || ''

            console.log(`[${callSid}] Stream started — user: ${userId}, project: ${projectId}, new: ${isNewUser}`)

            // Set up tool context
            toolCtx = {
              callSid,
              sessionId: '',
              userId,
              projectId,
              phoneNumber,
              builderApiUrl: BUILDER_API_URL,
            }

            // Create call session in DB
            createCallSession({
              callSid,
              userId,
              projectId,
              phoneNumber,
              isNewUser,
            }).then((session) => {
              sessionId = session.id
              if (toolCtx) toolCtx.sessionId = session.id
            }).catch((err) => {
              console.error(`[${callSid}] Failed to create call session:`, err)
            })

            // Subscribe to Supabase Realtime for page-open events
            subscribeToCallChannel(callSid, () => {
              console.log(`[${callSid}] Page opened by user`)
            })

            // Connect to OpenAI Realtime
            openaiWs = connectToOpenAI()
            break
          }

          case 'media':
            // Forward caller audio to OpenAI
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
              }))
            }
            break

          case 'stop':
            console.log(`[${callSid}] Twilio stream stopped`)
            break
        }
      })

      twilioWs.on('close', async () => {
        console.log(`[${callSid}] Twilio WebSocket closed`)

        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.close()
        }

        if (callSid) {
          await endCallSession(callSid).catch(() => {})
          await broadcastCallEnded(callSid).catch(() => {})
          cleanupChannel(callSid)
        }
      })

      twilioWs.on('error', (err) => {
        console.error('Twilio WebSocket error:', err)
      })
    })
  })

  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`Voice server listening on ${HOST}:${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
