import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribe(audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> {
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' })
  const file = new File([blob], filename, { type: 'audio/webm' })
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })
  return transcription.text
}
