'use client'

import { useRef, useState, useCallback } from 'react'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES = 3
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

interface ImagePickerProps {
  images: File[]
  onImagesChange: (files: File[]) => void
  disabled?: boolean
}

export function ImagePicker({ images, onImagesChange, disabled }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const validateAndAdd = useCallback(
    (files: FileList | File[]) => {
      setError(null)
      const newFiles: File[] = []
      const fileArray = Array.from(files)

      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) {
          setError('Only images are allowed')
          continue
        }
        if (file.size > MAX_SIZE) {
          setError(`${file.name} is too large (max 5MB)`)
          continue
        }
        newFiles.push(file)
      }

      const combined = [...images, ...newFiles].slice(0, MAX_IMAGES)
      if (images.length + newFiles.length > MAX_IMAGES) {
        setError(`Max ${MAX_IMAGES} images per message`)
      }
      onImagesChange(combined)
    },
    [images, onImagesChange]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAdd(e.target.files)
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
    setError(null)
  }

  return (
    <>
      {/* Paperclip button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || images.length >= MAX_IMAGES}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
        aria-label="Attach image"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Preview strip + error shown in parent via ImagePreviewStrip */}
      {error && (
        <div className="absolute bottom-full left-0 right-0 px-3 pb-1">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </>
  )
}

/**
 * Thumbnail strip showing attached images with remove buttons.
 * Rendered above the prompt bar.
 */
export function ImagePreviewStrip({
  images,
  onRemove,
}: {
  images: File[]
  onRemove: (index: number) => void
}) {
  if (images.length === 0) return null

  return (
    <div className="flex gap-2 px-3 py-2 border-t border-white/10">
      {images.map((file, i) => (
        <div key={`${file.name}-${i}`} className="relative group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="w-14 h-14 rounded-lg object-cover border border-white/20"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
