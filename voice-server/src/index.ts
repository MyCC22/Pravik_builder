import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyFormbody from '@fastify/formbody'
import { VoiceOrchestrator } from './agents/voice-orchestrator.js'

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function start() {
  const fastify = Fastify({
    logger: true,
  })

  await fastify.register(fastifyFormbody)
  await fastify.register(fastifyWebsocket)

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'pravik-voice-server' }
  })

  // WebSocket route for Twilio ConversationRelay
  fastify.register(async function (fastify) {
    fastify.get('/call', { websocket: true }, (socket, req) => {
      console.log('New ConversationRelay WebSocket connection')

      const orchestrator = new VoiceOrchestrator(socket)

      socket.on('message', async (data) => {
        try {
          const message = data.toString()
          await orchestrator.handleMessage(message)
        } catch (err) {
          console.error('Error handling WebSocket message:', err)
        }
      })

      socket.on('close', async () => {
        console.log('ConversationRelay WebSocket closed')
        await orchestrator.cleanup()
      })

      socket.on('error', (err) => {
        console.error('WebSocket error:', err)
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
