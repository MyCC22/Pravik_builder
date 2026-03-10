'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        setTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const { text } = await res.json()
            if (text) onTranscription(text)
          }
        } finally {
          setTranscribing(false)
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }, [onTranscription])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || transcribing}
      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
        recording
          ? 'bg-red-500 animate-pulse'
          : transcribing
          ? 'bg-white/10 text-gray-500'
          : 'bg-white/10 text-white hover:bg-white/20'
      } disabled:opacity-50`}
      aria-label={recording ? 'Stop recording' : 'Start recording'}
    >
      {transcribing ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 2.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-3.07z" />
        </svg>
      )}
    </button>
  )
}
