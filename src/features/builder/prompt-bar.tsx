'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VoiceRecorder } from './voice-recorder'
import { ImagePicker, ImagePreviewStrip } from './image-picker'

interface PromptBarProps {
  onSend: (message: string, images?: File[]) => void
  disabled?: boolean
}

export function PromptBar({ onSend, disabled }: PromptBarProps) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 80)}px`
    }
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if ((!trimmed && images.length === 0) || disabled) return
    onSend(trimmed || 'Use this image', images.length > 0 ? images : undefined)
    setText('')
    setImages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
        if (imageFiles.length > 0) {
          setImages((prev) => [...prev, ...imageFiles].slice(0, 3))
        }
      }
    },
    []
  )

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative ${isDragging ? 'ring-2 ring-white/30 ring-inset' : ''}`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-white/5 z-10 flex items-center justify-center pointer-events-none rounded-lg">
          <p className="text-sm text-white/60">Drop image here</p>
        </div>
      )}

      {/* Image preview strip */}
      <ImagePreviewStrip
        images={images}
        onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
      />

      <div className="flex items-end gap-2 px-3 py-2 border-t border-white/10 bg-black safe-bottom">
        <VoiceRecorder
          onTranscription={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
          disabled={disabled}
        />

        <ImagePicker
          images={images}
          onImagesChange={setImages}
          disabled={disabled}
        />

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={images.length > 0 ? 'What should I do with this image?' : 'Describe your website...'}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-white/30 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || (!text.trim() && images.length === 0)}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-white"
          aria-label="Send message"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
